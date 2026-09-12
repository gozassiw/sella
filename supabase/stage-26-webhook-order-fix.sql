-- Sella Stage 26: fix webhook processing order and subscription schema mismatch.
-- Subscription rows use started_at/paid_at; they do not have created_at.

create or replace function public.process_transactpay_subscription(
  p_event_key text,
  p_payload jsonb,
  p_successful boolean,
  p_amount numeric default 0,
  p_payment_reference text default null,
  p_order_reference text default null
)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_store public.stores%rowtype;
  v_event_id uuid;
  v_owner_id uuid;
  v_days integer;
begin
  select * into v_subscription
  from public.subscriptions
  where (nullif(p_order_reference, '') is not null and id::text = p_order_reference)
     or (nullif(p_payment_reference, '') is not null and (payment_reference = p_payment_reference or id::text = p_payment_reference))
  order by coalesce(paid_at, started_at) desc nulls last
  limit 1;

  if v_subscription.id is null then
    return jsonb_build_object('handled', false);
  end if;

  insert into public.payment_webhook_events(provider, event_key, payload)
  values ('transactpay', p_event_key, coalesce(p_payload, '{}'::jsonb))
  on conflict (event_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return jsonb_build_object('handled', true, 'duplicate', true);
  end if;

  if not coalesce(p_successful, false) or coalesce(p_amount, 0) < v_subscription.amount then
    return jsonb_build_object('handled', true, 'ignored', true, 'reason', 'payment_not_successful_or_insufficient');
  end if;

  select * into v_store from public.stores where id = v_subscription.store_id;
  v_owner_id := v_store.owner_id;
  v_days := case v_subscription.plan when 'quarterly' then 90 when 'biannual' then 180 when 'yearly' then 365 else 90 end;

  update public.subscriptions
  set status = 'paid', paid_at = now(), started_at = now(),
      expires_at = now() + make_interval(days => v_days),
      paid_with = 'transfer', payment_reference = coalesce(p_payment_reference, payment_reference)
  where id = v_subscription.id;

  update public.stores
  set plan = v_subscription.plan, trial_ends_at = now(),
      is_published = case when approval_status = 'approved' then true else is_published end
  where id = v_subscription.store_id;

  insert into public.notifications(user_id, type, title, body, link)
  values (v_owner_id, 'subscription', 'Plan upgraded', format('Your %s Sella plan is now active after payment confirmation.', v_subscription.plan), '/dashboard/billing');

  return jsonb_build_object('handled', true, 'paid', true, 'subscription_id', v_subscription.id, 'user_id', v_owner_id, 'amount', v_subscription.amount);
end;
$$;

grant execute on function public.process_transactpay_subscription(text, jsonb, boolean, numeric, text, text) to anon, authenticated;
notify pgrst, 'reload schema';

-- Keep a reproducible record of the corrected processor definition.
-- Wallet and order payment matching is handled independently by process_transactpay_webhook.
