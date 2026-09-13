-- Sella Stage 39: direct seller balances, trusted-store access, seller IDs,
-- report-based order suspension, and fixed withdrawal fee handling.
-- Escrow columns remain for backward-compatible historical rows, but are no
-- longer used as a payment gate.

alter table public.stores
  add column if not exists seller_code text,
  add column if not exists seller_code_active boolean not null default true,
  add column if not exists order_access_suspended boolean not null default false;

alter table public.withdrawals
  add column if not exists fee numeric(12,2) not null default 0,
  add column if not exists payout_amount numeric(12,2);

create unique index if not exists stores_seller_code_unique_idx
  on public.stores(seller_code)
  where seller_code is not null;

create or replace function public.generate_seller_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_code text;
begin
  loop
    v_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
    exit when not exists (select 1 from public.stores where seller_code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.ensure_store_seller_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(new.seller_code), '') is null then
    new.seller_code := public.generate_seller_code();
  else
    new.seller_code := upper(trim(new.seller_code));
  end if;
  if new.seller_code_active is null then new.seller_code_active := true; end if;
  if new.order_access_suspended is null then new.order_access_suspended := false; end if;
  return new;
end;
$$;

drop trigger if exists stores_seller_code_guard on public.stores;
create trigger stores_seller_code_guard
before insert or update on public.stores
for each row execute function public.ensure_store_seller_code();

update public.stores
set seller_code = public.generate_seller_code()
where seller_code is null;

update public.withdrawals
set payout_amount = coalesce(payout_amount, amount), fee = coalesce(fee, 0)
where payout_amount is null;

-- Release any historical held seller balance once, then keep the legacy column
-- at zero so old rows cannot recreate the previous escrow experience.
update public.wallets
set available = coalesce(available, 0) + coalesce(held, 0), held = 0
where coalesce(held, 0) <> 0;

update public.orders
set escrow_status = 'released'
where escrow_status is null or escrow_status in ('held', 'pending');

create or replace function public.store_can_receive_orders(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.stores s
    where s.id = p_store_id
      and s.approval_status = 'approved'
      and s.is_published = true
      and coalesce(s.seller_code_active, true) = true
      and coalesce(s.order_access_suspended, false) = false
      and not public.is_account_held(s.owner_id)
  );
$$;
grant execute on function public.store_can_receive_orders(uuid) to anon, authenticated;

revoke all on function public.generate_seller_code() from public;

create or replace function public.create_checkout_order(
  p_store_id uuid,
  p_buyer_id uuid,
  p_items jsonb,
  p_customer jsonb,
  p_fulfilment_method text,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_order_id uuid;
  v_order_code text;
  v_customer_id uuid;
  v_subtotal numeric(12,2) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_total numeric(12,2);
  v_updated integer;
begin
  if auth.uid() is null or auth.uid() <> p_buyer_id then raise exception 'Not authorised'; end if;
  if not public.store_can_receive_orders(p_store_id) then raise exception 'This store is not currently accepting new orders.'; end if;
  if not exists (select 1 from public.buyer_store_follows where user_id = p_buyer_id and store_id = p_store_id) then
    raise exception 'Trust this store before ordering.';
  end if;
  if p_fulfilment_method not in ('pickup','delivery') then raise exception 'Invalid fulfilment method'; end if;
  if p_payment_method not in ('wallet','transfer') then raise exception 'Invalid payment method'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty'; end if;

  insert into public.customers(store_id, name, phone, whatsapp, email, address)
  values (
    p_store_id,
    coalesce(nullif(trim(p_customer->>'name'), ''), 'Buyer'),
    nullif(trim(p_customer->>'phone'), ''),
    nullif(trim(p_customer->>'whatsapp'), ''),
    nullif(trim(p_customer->>'email'), ''),
    case when p_fulfilment_method = 'delivery' then nullif(trim(p_customer->>'address'), '') else 'pickup' end
  ) returning id into v_customer_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products
    where id = (v_item->>'productId')::uuid and store_id = p_store_id and is_active = true
    for update;
    if not found then raise exception 'Product is unavailable'; end if;
    v_qty := greatest(1, (v_item->>'quantity')::integer);
    if v_product.stock < v_qty then raise exception 'Not enough stock for %', v_product.name; end if;
    v_subtotal := v_subtotal + (v_product.price * v_qty);
  end loop;

  v_total := v_subtotal;
  insert into public.orders(
    store_id, customer_id, buyer_id, channel, status, payment_status,
    subtotal, delivery_fee, total, fulfilment_method, delivery_code,
    payment_method, escrow_status
  ) values (
    p_store_id, v_customer_id, p_buyer_id, 'website', 'pending', 'unpaid',
    v_subtotal, 0, v_total, p_fulfilment_method,
    lpad((floor(random() * 10000))::text, 4, '0'), p_payment_method, 'released'
  ) returning id, order_code into v_order_id, v_order_code;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id = (v_item->>'productId')::uuid and store_id = p_store_id;
    v_qty := greatest(1, (v_item->>'quantity')::integer);
    update public.products set stock = stock - v_qty where id = v_product.id and stock >= v_qty;
    get diagnostics v_updated = row_count;
    if v_updated <> 1 then raise exception 'Not enough stock for %', v_product.name; end if;
    insert into public.order_items(order_id, product_id, name, price, cost_price, quantity)
    values(v_order_id, v_product.id, v_product.name, v_product.price, v_product.cost_price, v_qty);
  end loop;

  return jsonb_build_object('id', v_order_id, 'order_code', v_order_code, 'total', v_total);
end;
$$;
grant execute on function public.create_checkout_order(uuid, uuid, jsonb, jsonb, text, text) to authenticated;

create or replace function public.pay_order_from_wallet(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_wallet public.buyer_wallets%rowtype;
  v_commission_setting jsonb;
  v_commission_rate numeric := 3;
  v_commission numeric(12,2);
  v_net numeric(12,2);
begin
  select * into v_order from public.orders where id = p_order_id and buyer_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.payment_status <> 'unpaid' then raise exception 'Order is already paid'; end if;
  select * into v_wallet from public.buyer_wallets where user_id = auth.uid() for update;
  if not found or v_wallet.balance < v_order.total then raise exception 'Insufficient wallet balance'; end if;
  select value into v_commission_setting from public.app_settings where key = 'commission_rate' limit 1;
  v_commission_rate := least(100, greatest(0, coalesce((v_commission_setting->>'rate')::numeric, 3)));
  v_commission := round(v_order.total * v_commission_rate / 100, 2);
  v_net := greatest(0, v_order.total - v_commission);

  update public.buyer_wallets set balance = balance - v_order.total where id = v_wallet.id;
  insert into public.buyer_wallet_transactions(buyer_wallet_id, order_id, amount, label)
  values (v_wallet.id, v_order.id, -v_order.total, 'Order payment · #' || v_order.order_code);
  insert into public.wallets(store_id, available, held)
  values (v_order.store_id, v_net, 0)
  on conflict (store_id) do update set available = coalesce(wallets.available, 0) + excluded.available, held = 0;
  insert into public.wallet_transactions(wallet_id, order_id, kind, amount, note)
  select id, v_order.id, 'credit', v_net, 'Wallet payment · #' || v_order.order_code from public.wallets where store_id = v_order.store_id;
  update public.orders set payment_status = 'paid', paid_at = now(), escrow_status = 'released', commission = v_commission, net_to_seller = v_net, payment_reference = 'wallet-' || v_order.id::text where id = v_order.id;
  return jsonb_build_object('success', true, 'order_id', v_order.id, 'order_code', v_order.order_code, 'seller_net', v_net, 'commission', v_commission);
end;
$$;
grant execute on function public.pay_order_from_wallet(uuid) to authenticated;

create or replace function public.process_transactpay_webhook(
  p_event_key text,
  p_payload jsonb,
  p_successful boolean,
  p_account_number text default null,
  p_account_reference text default null,
  p_amount numeric default 0,
  p_payment_reference text default null,
  p_order_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_wallet public.buyer_wallets%rowtype;
  v_order public.orders%rowtype;
  v_store public.stores%rowtype;
  v_wallet public.wallets%rowtype;
  v_commission_setting jsonb;
  v_commission_rate numeric := 3;
  v_provider_fee numeric := 0;
  v_net_amount numeric := 0;
  v_commission numeric;
  v_net numeric;
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
    v_provider_fee := least(round(p_amount * 1.5 / 100, 2), 2000);
    v_net_amount := greatest(0, round(p_amount - v_provider_fee, 2));
    update public.buyer_wallets set balance = coalesce(v_buyer_wallet.balance, 0) + v_net_amount where id = v_buyer_wallet.id;
    insert into public.buyer_wallet_transactions(buyer_wallet_id, amount, label, provider_reference)
    values (v_buyer_wallet.id, v_net_amount, 'TransactPay wallet funding (1.5% fee deducted, capped at NGN 2,000)', p_payment_reference);
    insert into public.notifications(user_id, type, title, body, link)
    values (v_buyer_wallet.user_id, 'wallet', 'Wallet funded', 'Your Sella wallet received NGN ' || to_char(v_net_amount, 'FM999,999,999,990.00') || '.', '/account/wallet');
    return jsonb_build_object('received', true, 'credited', 'buyer_wallet', 'wallet_id', v_buyer_wallet.id, 'user_id', v_buyer_wallet.user_id, 'amount', v_net_amount, 'gross_amount', p_amount, 'provider_fee', v_provider_fee);
  end if;

  if nullif(p_order_reference, '') is not null and p_order_reference ~* '^[0-9a-f]{8}-[0-9a-f-]{27}$' then
    select * into v_order from public.orders where id = p_order_reference::uuid limit 1 for update;
  else
    select * into v_order from public.orders where payment_reference = coalesce(nullif(p_order_reference, ''), p_payment_reference) or payment_reference = p_payment_reference order by created_at desc limit 1 for update;
  end if;
  if v_order.id is null or v_order.payment_status = 'paid' then return jsonb_build_object('received', true, 'ignored', true, 'reason', 'order_not_found_or_paid'); end if;
  select * into v_store from public.stores where id = v_order.store_id limit 1;
  if not public.store_can_receive_orders(v_order.store_id) then return jsonb_build_object('received', true, 'ignored', true, 'reason', 'store_not_receiving_orders'); end if;
  select value into v_commission_setting from public.app_settings where key = 'commission_rate' limit 1;
  v_commission_rate := least(100, greatest(0, coalesce((v_commission_setting->>'rate')::numeric, 3)));
  v_provider_fee := least(round(p_amount * 1.5 / 100, 2), 2000);
  v_commission := round(p_amount * v_commission_rate / 100, 2);
  v_net := greatest(0, round(p_amount - v_provider_fee - v_commission, 2));
  select * into v_wallet from public.wallets where store_id = v_order.store_id limit 1 for update;
  if v_wallet.id is null then
    insert into public.wallets(store_id, available, held) values (v_order.store_id, v_net, 0) returning * into v_wallet;
  else
    update public.wallets set available = coalesce(v_wallet.available, 0) + v_net, held = 0 where id = v_wallet.id returning * into v_wallet;
  end if;
  insert into public.wallet_transactions(wallet_id, order_id, kind, amount, note)
  values (v_wallet.id, v_order.id, 'credit', v_net, 'TransactPay payment (1.5% provider fee deducted, capped at NGN 2,000)');
  update public.orders set payment_status = 'paid', paid_at = now(), escrow_status = 'released', commission = v_commission, net_to_seller = v_net, payment_reference = coalesce(p_payment_reference, payment_reference) where id = v_order.id;
  insert into public.notifications(user_id, type, title, body, link) values (v_order.buyer_id, 'order', 'Payment confirmed', 'Payment for order #' || v_order.order_code || ' has been confirmed.', '/account/orders/' || v_order.id);
  insert into public.notifications(user_id, type, title, body, link) values (v_store.owner_id, 'order', 'Payment received', 'Payment for order #' || v_order.order_code || ' has been confirmed and is available in your wallet.', '/dashboard/orders?order=' || v_order.id);
  return jsonb_build_object('received', true, 'credited', 'seller_wallet', 'order_id', v_order.id, 'user_id', v_store.owner_id, 'amount', v_net, 'gross_amount', p_amount, 'provider_fee', v_provider_fee, 'commission', v_commission);
end;
$$;
grant execute on function public.process_transactpay_webhook(text, jsonb, boolean, text, text, numeric, text, text) to anon, authenticated;

create or replace function public.request_store_withdrawal(
  p_store_id uuid,
  p_amount numeric,
  p_bank_name text,
  p_account_number text,
  p_account_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_wallet public.wallets%rowtype;
  v_id uuid;
  v_fee numeric(12,2) := 120;
  v_payout numeric(12,2);
begin
  if not exists(select 1 from public.stores where id = p_store_id and owner_id = auth.uid()) then raise exception 'Not authorised'; end if;
  if p_amount <= v_fee then raise exception 'Withdrawal must be more than the ₦120 withdrawal fee'; end if;
  select * into v_wallet from public.wallets where store_id = p_store_id for update;
  if not found or coalesce(v_wallet.available, 0) < p_amount then raise exception 'Insufficient available balance'; end if;
  v_payout := p_amount - v_fee;
  insert into public.withdrawals(store_id, amount, fee, payout_amount, bank_name, account_number, account_name, note)
  values(p_store_id, p_amount, v_fee, v_payout, p_bank_name, p_account_number, p_account_name, '₦120 withdrawal fee deducted; seller receives ₦' || to_char(v_payout, 'FM999,999,999,990.00'))
  returning id into v_id;
  update public.wallets set available = available - p_amount, held = 0 where id = v_wallet.id;
  insert into public.wallet_transactions(wallet_id, kind, amount, note, status)
  values(v_wallet.id, 'withdrawal', -p_amount, 'Withdrawal request · ₦120 fee · payout ₦' || to_char(v_payout, 'FM999,999,999,990.00'), 'processing');
  return jsonb_build_object('id', v_id, 'requested_amount', p_amount, 'fee', v_fee, 'payout_amount', v_payout);
end;
$$;
grant execute on function public.request_store_withdrawal(uuid, numeric, text, text, text) to authenticated;

create or replace function public.release_order_escrow(p_order_id uuid, p_delivery_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_order public.orders%rowtype;
begin
  select o.* into v_order from public.orders o join public.stores s on s.id = o.store_id where o.id = p_order_id and s.owner_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.payment_status <> 'paid' then raise exception 'Order is not paid'; end if;
  update public.orders set status = 'delivered', escrow_status = 'released', delivered_at = now() where id = v_order.id;
  return jsonb_build_object('success', true, 'message', 'Delivery marked complete. Payment was already available to the seller.');
end;
$$;
grant execute on function public.release_order_escrow(uuid, text) to authenticated;

create or replace function public.cancel_order_and_refund(p_order_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_order public.orders%rowtype; v_item record; v_wallet public.buyer_wallets%rowtype; v_seller_wallet public.wallets%rowtype;
begin
  select o.* into v_order from public.orders o join public.stores s on s.id = o.store_id where o.id = p_order_id and s.owner_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status in ('shipped','delivered','cancelled') then raise exception 'This order cannot be cancelled'; end if;
  if v_order.payment_status = 'paid' and v_order.payment_method = 'wallet' then
    select * into v_seller_wallet from public.wallets where store_id = v_order.store_id for update;
    if not found or coalesce(v_seller_wallet.available, 0) < coalesce(v_order.net_to_seller, 0) then raise exception 'Seller wallet cannot cover this refund yet'; end if;
  end if;
  for v_item in select product_id, quantity from public.order_items where order_id = v_order.id loop update public.products set stock = stock + v_item.quantity where id = v_item.product_id; end loop;
  if v_order.payment_status = 'paid' and v_order.payment_method = 'wallet' then
    select * into v_wallet from public.buyer_wallets where user_id = v_order.buyer_id for update;
    if found then
      update public.buyer_wallets set balance = balance + v_order.total where id = v_wallet.id;
      insert into public.buyer_wallet_transactions(buyer_wallet_id, order_id, amount, label) values (v_wallet.id, v_order.id, v_order.total, 'Refund for cancelled order #' || v_order.order_code);
      update public.wallets set available = available - v_order.net_to_seller where id = v_seller_wallet.id;
      insert into public.wallet_transactions(wallet_id, order_id, kind, amount, note) values (v_seller_wallet.id, v_order.id, 'refund', -v_order.net_to_seller, 'Refund for cancelled order #' || v_order.order_code);
    end if;
  end if;
  update public.orders set status = 'cancelled', payment_status = case when payment_status = 'paid' then 'refunded' else payment_status end, escrow_status = 'released', cancelled_at = now(), cancellation_reason = p_reason where id = v_order.id;
  return jsonb_build_object('success', true);
end;
$$;
grant execute on function public.cancel_order_and_refund(uuid, text) to authenticated;

-- Extend authenticated admin actions with report-based order access suspension.
create or replace function public.admin_apply_action(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_store_id uuid;
  v_key text;
  v_status text;
  v_approved boolean;
  v_suspended boolean;
  v_now timestamptz := now();
  v_store public.stores%rowtype;
begin
  if not public.is_platform_admin() then raise exception 'Admin access required'; end if;
  if p_action = 'store_trust' then
    update public.stores set trusted = coalesce((p_payload->>'trusted')::boolean, false) where id = (p_payload->>'storeId')::uuid;
  elsif p_action = 'store_order_access' then
    v_suspended := coalesce((p_payload->>'suspended')::boolean, true);
    update public.stores set order_access_suspended = v_suspended, seller_code_active = not v_suspended where id = (p_payload->>'storeId')::uuid;
  elsif p_action = 'withdrawal_status' then
    v_status := p_payload->>'status';
    update public.withdrawals set status = v_status, note = nullif(p_payload->>'note', ''), processed_at = case when v_status = 'sent' then v_now else null end where id = (p_payload->>'withdrawalId')::uuid;
  elsif p_action = 'report_status' then
    update public.reports set status = coalesce(nullif(p_payload->>'status', ''), 'resolved') where id = (p_payload->>'reportId')::uuid;
  elsif p_action = 'setting' then
    v_key := p_payload->>'key';
    insert into public.app_settings(key, value, updated_at) values (v_key, coalesce(p_payload->'value', '{}'::jsonb), v_now) on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
  elsif p_action = 'verification' then
    v_approved := coalesce((p_payload->>'approved')::boolean, false);
    update public.stores set verification_approved = v_approved, nin_status = case when v_approved then 'verified' else 'pending' end, verification_notes = nullif(p_payload->>'notes', '') where id = (p_payload->>'storeId')::uuid;
  elsif p_action = 'store_approval' then
    v_approved := (p_payload->>'approvalStatus') = 'approved';
    v_store_id := (p_payload->>'storeId')::uuid;
    select * into v_store from public.stores where id = v_store_id;
    if v_approved and (nullif(trim(v_store.legal_name), '') is null or nullif(trim(v_store.nin), '') is null or nullif(trim(v_store.address), '') is null or not exists (select 1 from public.store_bank_accounts where store_id = v_store_id and nullif(trim(account_number), '') is not null)) then raise exception 'Complete the seller legal name, NIN, store or pickup address, and payout account before approval.'; end if;
    update public.stores set approval_status = case when v_approved then 'approved' else 'rejected' end, is_published = v_approved, approved_at = case when v_approved then v_now else null end, rejected_at = case when v_approved then null else v_now end, rejection_reason = case when v_approved then null else coalesce(nullif(p_payload->>'reason', ''), 'Please update your store details and resubmit for review.') end, trial_starts_at = case when v_approved then v_now else null end, trial_ends_at = case when v_approved then v_now + interval '10 days' else trial_ends_at end, verification_approved = v_approved, nin_status = case when v_approved then 'verified' else 'pending' end, verification_notes = nullif(p_payload->>'notes', '') where id = v_store_id;
  elsif p_action = 'account_hold' then
    if coalesce((p_payload->>'held')::boolean, true) then
      insert into public.account_holds(user_id, role, reason, status, held_at, released_at, held_by, updated_at) values ((p_payload->>'userId')::uuid, coalesce(nullif(p_payload->>'role', ''), 'both'), coalesce(nullif(trim(p_payload->>'reason'), ''), 'Account placed on hold by Sella Team.'), 'held', v_now, null, auth.uid(), v_now) on conflict (user_id) do update set role = excluded.role, reason = excluded.reason, status = 'held', held_at = v_now, released_at = null, held_by = auth.uid(), updated_at = v_now;
    else update public.account_holds set status = 'released', released_at = v_now, updated_at = v_now where user_id = (p_payload->>'userId')::uuid;
    end if;
  else raise exception 'Unknown admin action';
  end if;
  insert into public.admin_audit_logs(admin_user_id, action, entity, entity_id, details) values (auth.uid(), p_action, nullif(p_payload->>'entity', ''), coalesce(nullif(p_payload->>'storeId', ''), nullif(p_payload->>'withdrawalId', ''), nullif(p_payload->>'reportId', ''), nullif(p_payload->>'userId', ''))::uuid, p_payload - 'publicKey' - 'secretKey' - 'encryptionKey');
  return jsonb_build_object('success', true);
end;
$$;
grant execute on function public.admin_apply_action(text, jsonb) to authenticated;

create or replace function public.resolve_store_access_code(p_code text)
returns table(store_id uuid, slug text, store_name text)
language sql
stable
security definer
set search_path = public
as $$
  select id, slug, name from public.stores
  where upper(seller_code) = upper(trim(p_code))
    and coalesce(seller_code_active, true) = true
    and approval_status = 'approved'
    and is_published = true
    and coalesce(order_access_suspended, false) = false
  limit 1;
$$;
grant execute on function public.resolve_store_access_code(text) to authenticated;

notify pgrst, 'reload schema';
