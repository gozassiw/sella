-- Sella Stage 64: pay seller plans from balance and expire transfer accounts after 30 minutes.

alter table public.subscriptions
  add column if not exists payment_account_expires_at timestamptz;

create or replace function public.pay_subscription_from_wallet(
  p_store_id uuid,
  p_plan text,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_store public.stores%rowtype;
  v_wallet public.wallets%rowtype;
  v_subscription public.subscriptions%rowtype;
  v_days integer;
  v_amount numeric(12,2);
begin
  if auth.uid() is null then raise exception 'Not authorised'; end if;
  if p_plan not in ('basic','plus','premium') then raise exception 'Invalid plan'; end if;

  v_amount := case p_plan when 'basic' then 7500 when 'plus' then 14000 when 'premium' then 25000 end;
  if coalesce(p_amount, 0) <> v_amount then raise exception 'Invalid plan amount'; end if;
  v_days := case p_plan when 'basic' then 90 when 'plus' then 180 when 'premium' then 365 end;

  select * into v_store
  from public.stores
  where id = p_store_id and owner_id = auth.uid()
  for update;
  if not found then raise exception 'Store not found'; end if;
  if v_store.approval_status is distinct from 'approved' or not coalesce(v_store.verification_approved, false) then
    raise exception 'Your store must be approved before billing';
  end if;

  select * into v_wallet from public.wallets where store_id = p_store_id for update;
  if not found then raise exception 'Seller balance is not available yet'; end if;
  if coalesce(v_wallet.available, 0) < v_amount then
    raise exception 'Insufficient Sella balance';
  end if;

  insert into public.subscriptions(
    store_id, plan, amount, started_at, expires_at, paid_with, status, paid_at, payment_reference, payment_account_expires_at
  ) values (
    p_store_id, p_plan, v_amount, now(), now() + make_interval(days => v_days), 'wallet', 'paid', now(), 'wallet:' || gen_random_uuid()::text, null
  ) returning * into v_subscription;

  update public.wallets
  set available = available - v_amount
  where id = v_wallet.id;

  insert into public.wallet_transactions(wallet_id, kind, amount, note)
  values (v_wallet.id, 'plan_payment', -v_amount, 'Payment for ' || initcap(p_plan) || ' Sella plan');

  update public.stores
  set plan = p_plan,
      trial_ends_at = now(),
      is_published = case when approval_status = 'approved' then true else is_published end
  where id = p_store_id;

  insert into public.notifications(user_id, type, title, body, link)
  values (auth.uid(), 'subscription', 'Plan upgraded', format('Your %s Sella plan is now active. %s has been deducted from your seller balance.', p_plan, to_char(v_amount, 'FM999G999G999G990D00')), '/dashboard/billing');

  return jsonb_build_object(
    'success', true,
    'paid', true,
    'paid_with', 'wallet',
    'subscription_id', v_subscription.id,
    'plan', p_plan,
    'amount', v_amount,
    'expires_at', v_subscription.expires_at
  );
end;
$$;

revoke all on function public.pay_subscription_from_wallet(uuid, text, numeric) from public, anon;
grant execute on function public.pay_subscription_from_wallet(uuid, text, numeric) to authenticated;

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
  select * into v_subscription from public.subscriptions
  where (nullif(p_order_reference, '') is not null and id::text = p_order_reference)
     or (nullif(p_payment_reference, '') is not null and (payment_reference = p_payment_reference or id::text = p_payment_reference))
  order by coalesce(paid_at, started_at) desc nulls last limit 1;
  if v_subscription.id is null then return jsonb_build_object('handled', false); end if;
  if v_subscription.status <> 'pending' then return jsonb_build_object('handled', true, 'ignored', true, 'reason', 'subscription_already_processed'); end if;
  if v_subscription.payment_account_expires_at is not null and now() > v_subscription.payment_account_expires_at then
    update public.subscriptions set status = 'expired' where id = v_subscription.id and status = 'pending';
    return jsonb_build_object('handled', true, 'ignored', true, 'reason', 'payment_account_expired');
  end if;

  insert into public.payment_webhook_events(provider, event_key, payload)
    values ('transactpay', p_event_key, coalesce(p_payload, '{}'::jsonb))
    on conflict (event_key) do nothing returning id into v_event_id;
  if v_event_id is null then return jsonb_build_object('handled', true, 'duplicate', true); end if;
  if not coalesce(p_successful, false) or coalesce(p_amount, 0) < v_subscription.amount then
    return jsonb_build_object('handled', true, 'ignored', true, 'reason', 'payment_not_successful_or_insufficient');
  end if;

  select * into v_store from public.stores where id = v_subscription.store_id;
  v_owner_id := v_store.owner_id;
  v_days := case v_subscription.plan when 'basic' then 90 when 'plus' then 180 when 'premium' then 365 when 'quarterly' then 90 when 'biannual' then 180 when 'yearly' then 365 else 90 end;
  update public.subscriptions
  set status = 'paid', paid_at = now(), started_at = now(), expires_at = now() + make_interval(days => v_days), paid_with = 'transfer', payment_reference = coalesce(p_payment_reference, payment_reference)
  where id = v_subscription.id and status = 'pending';
  update public.stores set plan = v_subscription.plan, trial_ends_at = now(), is_published = case when approval_status = 'approved' then true else is_published end where id = v_subscription.store_id;
  insert into public.notifications(user_id, type, title, body, link)
    values (v_owner_id, 'subscription', 'Plan upgraded', format('Your %s Sella plan is now active after payment confirmation.', v_subscription.plan), '/dashboard/billing');
  return jsonb_build_object('handled', true, 'paid', true, 'subscription_id', v_subscription.id, 'user_id', v_owner_id, 'amount', v_subscription.amount);
end;
$$;

grant execute on function public.process_transactpay_subscription(text, jsonb, boolean, numeric, text, text) to anon, authenticated;
notify pgrst, 'reload schema';
