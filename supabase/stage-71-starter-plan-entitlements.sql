-- Sella Stage 71: Starter plan, plan-based product limits, and plan commission matrix.
-- This is an additive corrective migration. Existing paid subscriptions and paid orders are preserved.

-- Buyer funding is already fee-free in the live configuration. Keep the legacy keys at zero
-- for compatibility with older code paths while the active UI no longer exposes buyer fees.
insert into public.app_settings(key, value, updated_at)
values
  ('deposit_fee_rate', '{"rate":0}'::jsonb, now()),
  ('bank_transfer_fee_rate', '{"rate":0}'::jsonb, now()),
  ('commission_rate', '{"rate":3.2}'::jsonb, now())
on conflict (key) do update
set value = excluded.value, updated_at = excluded.updated_at;

-- New stores use Starter indefinitely. Keep the historical columns nullable for old rows,
-- but stop assigning a trial expiry to new records.
alter table public.stores
  alter column plan set default 'starter',
  alter column trial_ends_at drop default,
  alter column trial_ends_at drop not null;

-- Historical trial stores become the free Starter plan. No paid subscription is removed.
update public.stores
set plan = 'starter', trial_starts_at = null, trial_ends_at = null
where plan = 'trial';

-- Normalize only legacy plan labels on stores where they were used by the old plan system.
update public.stores
set plan = case plan when 'quarterly' then 'basic' when 'biannual' then 'plus' when 'yearly' then 'premium' else plan end
where plan in ('quarterly', 'biannual', 'yearly');

create or replace function public.effective_seller_plan(p_store_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not exists (
      select 1
      from public.subscriptions sub
      where sub.store_id = p_store_id
        and sub.status in ('paid', 'active')
        and sub.started_at <= now()
        and sub.expires_at > now()
    ) then 'starter'
    else (
      select case lower(sub.plan)
        when 'quarterly' then 'basic'
        when 'biannual' then 'plus'
        when 'yearly' then 'premium'
        else lower(sub.plan)
      end
      from public.subscriptions sub
      where sub.store_id = p_store_id
        and sub.status in ('paid', 'active')
        and sub.started_at <= now()
        and sub.expires_at > now()
      order by sub.started_at desc, sub.paid_at desc nulls last
      limit 1
    )
  end;
$$;
revoke all on function public.effective_seller_plan(uuid) from public, anon;
grant execute on function public.effective_seller_plan(uuid) to authenticated;

create or replace function public.seller_plan_limit(p_store_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case public.effective_seller_plan(p_store_id)
    when 'starter' then 40
    when 'basic' then 150
    when 'plus' then 500
    when 'premium' then null
    else 40
  end;
$$;
revoke all on function public.seller_plan_limit(uuid) from public, anon;
grant execute on function public.seller_plan_limit(uuid) to authenticated;

create or replace function public.seller_commission_rate(p_store_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case public.effective_seller_plan(p_store_id)
    when 'starter' then 3.2
    when 'basic' then 2.8
    when 'plus' then 2.6
    when 'premium' then 2.4
    else 3.2
  end;
$$;
revoke all on function public.seller_commission_rate(uuid) from public, anon;
grant execute on function public.seller_commission_rate(uuid) to anon, authenticated;

create or replace function public.enforce_plan_product_limit()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_limit integer;
  v_count integer;
begin
  if auth.role() = 'authenticated' and not public.is_platform_admin() then
    if (tg_op = 'INSERT' and coalesce(new.is_active, false))
       or (tg_op = 'UPDATE' and old.is_active is distinct from new.is_active and coalesce(new.is_active, false)) then
      v_limit := public.seller_plan_limit(new.store_id);
      if v_limit is not null then
        select count(*)::integer into v_count
        from public.products
        where store_id = new.store_id and is_active = true;
        if v_count >= v_limit then
          raise exception 'Your seller plan allows up to % active product listings. Choose a higher plan to add more.', v_limit
            using detail = format('Current active listings: %s; limit: %s', v_count, v_limit);
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;

 drop trigger if exists products_trial_limit_guard on public.products;
 drop trigger if exists products_plan_limit_guard on public.products;
create trigger products_plan_limit_guard
before insert or update of is_active on public.products
for each row execute function public.enforce_plan_product_limit();

-- Keep the approval workflow, but stop creating a trial or telling sellers that a paid
-- plan is compulsory. Approved stores start on Starter unless an existing paid plan exists.
create or replace function public.admin_apply_action(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_store_id uuid; v_status text; v_approved boolean; v_now timestamptz := now(); v_store public.stores%rowtype; v_user_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'Admin access required'; end if;
  if p_action = 'store_trust' then
    update public.stores set trusted = coalesce((p_payload->>'trusted')::boolean, false) where id = (p_payload->>'storeId')::uuid;
  elsif p_action = 'withdrawal_status' then
    v_status := p_payload->>'status';
    update public.withdrawals
    set status = v_status, note = nullif(p_payload->>'note', ''), processed_at = case when v_status = 'sent' then v_now else null end
    where id = (p_payload->>'withdrawalId')::uuid;
  elsif p_action = 'report_status' then
    update public.reports set status = coalesce(nullif(p_payload->>'status', ''), 'resolved') where id = (p_payload->>'reportId')::uuid;
  elsif p_action = 'setting' then
    insert into public.app_settings(key, value, updated_at)
    values (p_payload->>'key', coalesce(p_payload->'value', '{}'::jsonb), v_now)
    on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
  elsif p_action = 'verification' then
    v_approved := coalesce((p_payload->>'approved')::boolean, false);
    update public.stores
    set verification_approved = v_approved,
        nin_status = case when v_approved then 'verified' else 'pending' end,
        verification_notes = nullif(p_payload->>'notes', '')
    where id = (p_payload->>'storeId')::uuid;
  elsif p_action = 'store_approval' then
    v_approved := (p_payload->>'approvalStatus') = 'approved';
    v_store_id := (p_payload->>'storeId')::uuid;
    select * into v_store from public.stores where id = v_store_id;
    if v_approved and (nullif(trim(v_store.legal_name), '') is null or nullif(trim(v_store.nin), '') is null or nullif(trim(v_store.address), '') is null or not exists (select 1 from public.store_bank_accounts where store_id = v_store_id and nullif(trim(account_number), '') is not null)) then
      raise exception 'Complete the seller legal name, NIN, store or pickup address, and payout account before approval.';
    end if;
    update public.stores
    set approval_status = case when v_approved then 'approved' else 'rejected' end,
        plan = case when v_approved and plan in ('trial', 'quarterly', 'biannual', 'yearly') then 'starter' else plan end,
        is_published = v_approved,
        approved_at = case when v_approved then v_now else null end,
        rejected_at = case when v_approved then null else v_now end,
        rejection_reason = case when v_approved then null else coalesce(nullif(p_payload->>'reason', ''), 'Please update your store details and resubmit for review.') end,
        trial_starts_at = null,
        trial_ends_at = null,
        verification_approved = v_approved,
        nin_status = case when v_approved then 'verified' else 'pending' end,
        verification_notes = nullif(p_payload->>'notes', '')
    where id = v_store_id;
    select owner_id into v_user_id from public.stores where id = v_store_id;
    insert into public.notifications(user_id, type, title, body, link)
    values (v_user_id,
      case when v_approved then 'approval' else 'verification' end,
      case when v_approved then 'Store approved' else 'Update requested for your store' end,
      case when v_approved then 'Your store is approved and starts on the free Starter plan. You can add up to 40 active product listings.' else coalesce(nullif(p_payload->>'reason', ''), 'Please update your seller details and resubmit for verification.') end,
      '/dashboard');
  elsif p_action = 'account_hold' then
    v_user_id := (p_payload->>'userId')::uuid;
    if coalesce((p_payload->>'held')::boolean, true) then
      insert into public.account_holds(user_id, role, reason, status, held_at, released_at, held_by, updated_at)
      values (v_user_id, coalesce(nullif(p_payload->>'role', ''), 'both'), coalesce(nullif(trim(p_payload->>'reason'), ''), 'Account placed on hold by Sella Team.'), 'held', v_now, null, auth.uid(), v_now)
      on conflict (user_id) do update set role = excluded.role, reason = excluded.reason, status = 'held', held_at = v_now, released_at = null, held_by = auth.uid(), updated_at = v_now;
      insert into public.notifications(user_id, type, title, body, link) values (v_user_id, 'account_hold', 'Account placed on hold', coalesce(nullif(trim(p_payload->>'reason'), ''), 'Sella Team has paused activity on this account.'), '/account/profile');
    else
      update public.account_holds set status = 'released', released_at = v_now, updated_at = v_now where user_id = v_user_id;
      insert into public.notifications(user_id, type, title, body, link) values (v_user_id, 'account_hold', 'Account released', 'Your Sella account is active again.', '/account');
    end if;
  else
    raise exception 'Unknown admin action';
  end if;
  insert into public.admin_audit_logs(admin_user_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, nullif(p_payload->>'entity', ''), coalesce(nullif(p_payload->>'storeId', ''), nullif(p_payload->>'withdrawalId', ''), nullif(p_payload->>'reportId', ''), nullif(p_payload->>'userId', ''))::uuid, p_payload - 'publicKey' - 'secretKey' - 'encryptionKey');
  return jsonb_build_object('success', true, 'user_id', v_user_id, 'store_id', v_store_id, 'approved', v_approved);
end;
$$;
grant execute on function public.admin_apply_action(text, jsonb) to authenticated;

-- Future plan payments use the plan rate. This replaces the global 3% fallback while
-- leaving historical order commission values untouched.
create or replace function public.process_transactpay_webhook(p_event_key text, p_payload jsonb, p_successful boolean, p_account_number text default null, p_account_reference text default null, p_amount numeric default 0, p_payment_reference text default null, p_order_reference text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_buyer_wallet public.buyer_wallets%rowtype;
  v_order public.orders%rowtype;
  v_store public.stores%rowtype;
  v_wallet public.wallets%rowtype;
  v_net_amount numeric(12,2) := 0;
  v_commission_rate numeric := 3.2;
  v_commission numeric(12,2);
  v_net numeric(12,2);
  v_required numeric(12,2);
  v_event_id uuid;
begin
  if nullif(trim(p_event_key), '') is null then raise exception 'Webhook event key is required'; end if;
  insert into public.payment_webhook_events(provider, event_key, payload)
  values ('transactpay', p_event_key, coalesce(p_payload, '{}'::jsonb))
  on conflict (event_key) do nothing returning id into v_event_id;
  if v_event_id is null then return jsonb_build_object('received', true, 'duplicate', true); end if;
  if not coalesce(p_successful, false) then return jsonb_build_object('received', true, 'ignored', true); end if;
  if coalesce(p_amount, 0) <= 0 then return jsonb_build_object('received', true, 'ignored', true, 'reason', 'amount_missing'); end if;

  select * into v_buyer_wallet from public.buyer_wallets
  where (nullif(p_account_number, '') is not null and dedicated_account_number = p_account_number)
     or (nullif(p_account_reference, '') is not null and dedicated_account_reference = p_account_reference)
  order by created_at asc limit 1 for update;
  if v_buyer_wallet.id is not null then
    v_net_amount := round(p_amount, 2);
    update public.buyer_wallets set balance = coalesce(v_buyer_wallet.balance, 0) + v_net_amount where id = v_buyer_wallet.id;
    insert into public.buyer_wallet_transactions(buyer_wallet_id, amount, label, provider_reference)
    values (v_buyer_wallet.id, v_net_amount, 'Wallet deposit', p_payment_reference);
    insert into public.notifications(user_id, type, title, body, link)
    values (v_buyer_wallet.user_id, 'wallet', 'Wallet funded', 'Your Sella wallet received NGN ' || to_char(v_net_amount, 'FM999,999,999,990.00') || '.', '/account/wallet');
    return jsonb_build_object('received', true, 'credited', 'buyer_wallet', 'wallet_id', v_buyer_wallet.id, 'user_id', v_buyer_wallet.user_id, 'amount', v_net_amount, 'gross_amount', p_amount);
  end if;

  if nullif(p_order_reference, '') is not null and p_order_reference ~* '^[0-9a-f]{8}-[0-9a-f-]{27}$' then
    select * into v_order from public.orders where id = p_order_reference::uuid limit 1 for update;
  else
    select * into v_order from public.orders
    where payment_reference = coalesce(nullif(p_order_reference, ''), p_payment_reference)
       or payment_reference = p_payment_reference
    order by created_at desc limit 1 for update;
  end if;
  if v_order.id is null or v_order.payment_status = 'paid' then return jsonb_build_object('received', true, 'ignored', true, 'reason', 'order_not_found_or_paid'); end if;
  v_required := greatest(coalesce(nullif(v_order.payment_total, 0), v_order.total), v_order.total);
  if p_amount < v_required then return jsonb_build_object('received', true, 'ignored', true, 'reason', 'amount_mismatch', 'required_amount', v_required, 'received_amount', p_amount); end if;

  select * into v_store from public.stores where id = v_order.store_id limit 1;
  v_commission_rate := public.seller_commission_rate(v_order.store_id);
  v_commission := round(v_order.total * v_commission_rate / 100, 2);
  v_net := greatest(0, round(v_order.total - v_commission, 2));
  select * into v_wallet from public.wallets where store_id = v_order.store_id limit 1 for update;
  if v_wallet.id is null then
    insert into public.wallets(store_id, available, held) values (v_order.store_id, v_net, 0) returning * into v_wallet;
  else
    update public.wallets set available = coalesce(v_wallet.available, 0) + v_net, held = 0 where id = v_wallet.id returning * into v_wallet;
  end if;
  insert into public.wallet_transactions(wallet_id, order_id, kind, amount, note)
  values (v_wallet.id, v_order.id, 'credit', v_net, 'Order payment · #' || v_order.order_code);
  update public.orders
  set payment_status = 'paid', paid_at = now(), payment_expires_at = null,
      escrow_status = 'released', commission = v_commission, net_to_seller = v_net,
      payment_reference = coalesce(p_payment_reference, payment_reference)
  where id = v_order.id;
  insert into public.notifications(user_id, type, title, body, link)
  values (v_order.buyer_id, 'order', 'Payment confirmed', 'Payment for order #' || v_order.order_code || ' has been confirmed.', '/account/orders/' || v_order.id);
  insert into public.notifications(user_id, type, title, body, link)
  values (v_store.owner_id, 'order', 'Payment received', 'Payment for order #' || v_order.order_code || ' has been confirmed.', '/dashboard/orders?order=' || v_order.id);
  return jsonb_build_object('received', true, 'credited', 'seller_wallet', 'order_id', v_order.id, 'user_id', v_store.owner_id, 'amount', v_net, 'gross_amount', p_amount, 'commission', v_commission, 'commission_rate', v_commission_rate, 'required_amount', v_required);
end;
$$;
grant execute on function public.process_transactpay_webhook(text, jsonb, boolean, text, text, numeric, text, text) to anon, authenticated, service_role;

-- Paid plan activation keeps the existing wallet and transfer flow, but always makes
-- the newest successful plan the effective plan. Existing paid records remain in history.
create or replace function public.pay_subscription_from_wallet(p_store_id uuid, p_plan text, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
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
  select * into v_store from public.stores where id = p_store_id and owner_id = auth.uid() for update;
  if not found then raise exception 'Store not found'; end if;
  if v_store.approval_status is distinct from 'approved' then raise exception 'Your store must be approved before billing'; end if;
  select * into v_wallet from public.wallets where store_id = p_store_id for update;
  if not found then raise exception 'Seller balance is not available yet'; end if;
  if coalesce(v_wallet.available, 0) < v_amount then raise exception 'Insufficient Sella balance'; end if;
  update public.subscriptions set status = 'expired' where store_id = p_store_id and status in ('paid','active') and expires_at > now();
  insert into public.subscriptions(store_id, plan, amount, started_at, expires_at, paid_with, status, paid_at, payment_reference, payment_account_expires_at)
  values (p_store_id, p_plan, v_amount, now(), now() + make_interval(days => v_days), 'wallet', 'paid', now(), 'wallet:' || gen_random_uuid()::text, null)
  returning * into v_subscription;
  update public.wallets set available = available - v_amount where id = v_wallet.id;
  insert into public.wallet_transactions(wallet_id, kind, amount, note)
  values (v_wallet.id, 'plan_payment', -v_amount, 'Payment for ' || initcap(p_plan) || ' Sella plan');
  update public.stores set plan = p_plan, trial_ends_at = null, trial_starts_at = null, is_published = case when approval_status = 'approved' then true else is_published end where id = p_store_id;
  insert into public.notifications(user_id, type, title, body, link)
  values (auth.uid(), 'subscription', 'Plan upgraded', format('Your %s Sella plan is now active. %s has been deducted from your seller balance.', p_plan, to_char(v_amount, 'FM999G999G999G990D00')), '/dashboard/billing');
  return jsonb_build_object('success', true, 'paid', true, 'paid_with', 'wallet', 'subscription_id', v_subscription.id, 'plan', p_plan, 'amount', v_amount, 'expires_at', v_subscription.expires_at);
end;
$$;
grant execute on function public.pay_subscription_from_wallet(uuid, text, numeric) to authenticated;

-- The webhook subscription matcher remains compatible with historical account fields,
-- while expiring an older active plan when a newer transfer plan is confirmed.
create or replace function public.process_transactpay_subscription(p_event_key text, p_payload jsonb, p_successful boolean, p_amount numeric default 0, p_payment_reference text default null, p_order_reference text default null)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_store public.stores%rowtype;
  v_event_id uuid;
  v_owner_id uuid;
  v_days integer;
  v_account_number text;
  v_account_reference text;
begin
  v_account_number := coalesce(nullif(p_payload #>> '{data,orderPayments,0,orderPaymentInstrument}', ''), nullif(p_payload #>> '{Data,OrderPayments,0,orderPaymentInstrument}', ''), nullif(p_payload #>> '{data,accountNumber}', ''), nullif(p_payload #>> '{Data,AccountNumber}', ''), nullif(p_payload #>> '{accountNumber}', ''), nullif(p_payload #>> '{AccountNumber}', ''));
  v_account_reference := coalesce(nullif(p_payload #>> '{data,accountReference}', ''), nullif(p_payload #>> '{Data,AccountReference}', ''), nullif(p_payload #>> '{accountReference}', ''), nullif(p_payload #>> '{AccountReference}', ''));
  select * into v_subscription from public.subscriptions
  where (nullif(p_order_reference, '') is not null and id::text = p_order_reference)
     or (nullif(p_payment_reference, '') is not null and payment_reference = p_payment_reference)
     or (nullif(v_account_reference, '') is not null and payment_reference = v_account_reference)
     or (nullif(v_account_number, '') is not null and payment_account_number = v_account_number)
  order by case when status = 'pending' then 0 else 1 end, started_at desc nulls last limit 1;
  if v_subscription.id is null then return jsonb_build_object('handled', false); end if;
  insert into public.payment_webhook_events(provider, event_key, payload)
  values ('transactpay', p_event_key, coalesce(p_payload, '{}'::jsonb))
  on conflict (event_key) do nothing returning id into v_event_id;
  if v_event_id is null then return jsonb_build_object('handled', true, 'duplicate', true); end if;
  if v_subscription.status <> 'pending' then return jsonb_build_object('handled', true, 'ignored', true, 'reason', 'subscription_already_processed'); end if;
  if v_subscription.payment_account_expires_at is not null and now() > v_subscription.payment_account_expires_at then
    update public.subscriptions set status = 'expired' where id = v_subscription.id and status = 'pending';
    return jsonb_build_object('handled', true, 'ignored', true, 'reason', 'payment_account_expired', 'subscription_id', v_subscription.id);
  end if;
  if not coalesce(p_successful, false) or coalesce(p_amount, 0) < v_subscription.amount then return jsonb_build_object('handled', true, 'ignored', true, 'reason', 'payment_not_successful_or_insufficient', 'subscription_id', v_subscription.id); end if;
  select * into v_store from public.stores where id = v_subscription.store_id;
  v_owner_id := v_store.owner_id;
  v_days := case v_subscription.plan when 'basic' then 90 when 'plus' then 180 when 'premium' then 365 when 'quarterly' then 90 when 'biannual' then 180 when 'yearly' then 365 else 90 end;
  update public.subscriptions set status = 'expired' where store_id = v_subscription.store_id and id <> v_subscription.id and status in ('paid','active') and expires_at > now();
  update public.subscriptions set status = 'paid', paid_at = now(), started_at = now(), expires_at = now() + make_interval(days => v_days), paid_with = 'transfer', payment_reference = coalesce(p_payment_reference, payment_reference) where id = v_subscription.id and status = 'pending';
  update public.stores set plan = case v_subscription.plan when 'quarterly' then 'basic' when 'biannual' then 'plus' when 'yearly' then 'premium' else v_subscription.plan end, trial_ends_at = null, trial_starts_at = null, is_published = case when approval_status = 'approved' then true else is_published end where id = v_subscription.store_id;
  insert into public.notifications(user_id, type, title, body, link) values (v_owner_id, 'subscription', 'Plan upgraded', format('Your %s Sella plan is now active after payment confirmation.', v_subscription.plan), '/dashboard/billing');
  return jsonb_build_object('handled', true, 'paid', true, 'subscription_id', v_subscription.id, 'user_id', v_owner_id, 'amount', v_subscription.amount);
end;
$$;
grant execute on function public.process_transactpay_subscription(text, jsonb, boolean, numeric, text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
