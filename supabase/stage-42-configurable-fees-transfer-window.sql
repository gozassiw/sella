-- Sella Stage 42: independent configurable fees and bank-transfer payment window.
-- New settings affect new deposits, new orders, new paid orders, and new
-- withdrawal requests. Historical transaction rows keep their captured values.

alter table public.orders
  add column if not exists bank_transfer_fee numeric(12,2) not null default 0,
  add column if not exists payment_total numeric(12,2) not null default 0,
  add column if not exists payment_expires_at timestamptz,
  add column if not exists payment_session_id text;

update public.orders
set payment_total = total
where coalesce(payment_total, 0) = 0;

insert into public.app_settings(key, value, updated_at)
values
  ('deposit_fee_rate', '{"rate":1.5}'::jsonb, now()),
  ('bank_transfer_fee_rate', '{"rate":0}'::jsonb, now()),
  ('commission_rate', '{"rate":3}'::jsonb, now()),
  ('withdrawal_fee', '{"amount":120}'::jsonb, now())
on conflict (key) do nothing;

-- Capture the current bank-transfer surcharge when the order is created.
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
  v_transfer_rate numeric := 0;
  v_transfer_fee numeric(12,2) := 0;
  v_payment_total numeric(12,2) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_updated integer;
begin
  if auth.uid() is null or auth.uid() <> p_buyer_id then raise exception 'Not authorised'; end if;
  if not public.store_can_receive_orders(p_store_id) then raise exception 'This store is not currently accepting new orders.'; end if;
  if not exists (select 1 from public.buyer_store_follows where user_id = p_buyer_id and store_id = p_store_id) then raise exception 'Trust this store before ordering.'; end if;
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

  if p_payment_method = 'transfer' then
    select least(100, greatest(0, coalesce((value->>'rate')::numeric, 0)))
    into v_transfer_rate
    from public.app_settings where key = 'bank_transfer_fee_rate' limit 1;
    v_transfer_fee := round(v_subtotal * v_transfer_rate / 100, 2);
  end if;
  v_payment_total := round(v_subtotal + v_transfer_fee, 2);

  insert into public.orders(
    store_id, customer_id, buyer_id, channel, status, payment_status,
    subtotal, delivery_fee, total, bank_transfer_fee, payment_total,
    fulfilment_method, delivery_code, payment_method, escrow_status
  ) values (
    p_store_id, v_customer_id, p_buyer_id, 'website', 'pending', 'unpaid',
    v_subtotal, 0, v_subtotal, v_transfer_fee, v_payment_total,
    p_fulfilment_method, lpad((floor(random() * 10000))::text, 4, '0'),
    p_payment_method, 'released'
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

  return jsonb_build_object(
    'id', v_order_id,
    'order_code', v_order_code,
    'total', v_subtotal,
    'bank_transfer_fee', v_transfer_fee,
    'payment_total', v_payment_total
  );
end;
$$;
grant execute on function public.create_checkout_order(uuid, uuid, jsonb, jsonb, text, text) to authenticated;

-- Save the account details and start the 30-minute payment window.
drop function if exists public.set_order_payment_account(uuid, text, text, text, text);
create or replace function public.set_order_payment_account(
  p_order_id uuid,
  p_account_number text,
  p_account_name text default null,
  p_bank_name text default null,
  p_payment_reference text default null,
  p_payment_session_id text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_order public.orders;
begin
  if auth.uid() is null then raise exception 'Not authorised'; end if;
  update public.orders
  set payment_account_number = p_account_number,
      payment_account_name = p_account_name,
      payment_bank_name = p_bank_name,
      payment_reference = coalesce(p_payment_reference, payment_reference),
      payment_session_id = coalesce(nullif(p_payment_session_id, ''), payment_session_id),
      payment_expires_at = now() + interval '30 minutes'
  where id = p_order_id and buyer_id = auth.uid() and payment_status = 'unpaid'
  returning * into v_order;
  if not found then raise exception 'Order not found'; end if;
  return v_order;
end;
$$;
grant execute on function public.set_order_payment_account(uuid, text, text, text, text, text) to authenticated;

-- Wallet checkout uses the current commission setting and credits the seller
-- directly. The seller notification is sent by the API only after this succeeds.
create or replace function public.pay_order_from_wallet(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
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
  if v_order.payment_method <> 'wallet' then raise exception 'This order is set up for bank transfer'; end if;
  select * into v_wallet from public.buyer_wallets where user_id = auth.uid() for update;
  if not found or v_wallet.balance < v_order.total then raise exception 'Insufficient wallet balance'; end if;
  select value into v_commission_setting from public.app_settings where key = 'commission_rate' limit 1;
  v_commission_rate := least(100, greatest(0, coalesce((v_commission_setting->>'rate')::numeric, 3)));
  v_commission := round(v_order.total * v_commission_rate / 100, 2);
  v_net := greatest(0, round(v_order.total - v_commission, 2));

  update public.buyer_wallets set balance = balance - v_order.total where id = v_wallet.id;
  insert into public.buyer_wallet_transactions(buyer_wallet_id, order_id, amount, label)
  values (v_wallet.id, v_order.id, -v_order.total, 'Order payment · #' || v_order.order_code);
  insert into public.wallets(store_id, available, held)
  values (v_order.store_id, v_net, 0)
  on conflict (store_id) do update set available = coalesce(wallets.available, 0) + excluded.available, held = 0;
  insert into public.wallet_transactions(wallet_id, order_id, kind, amount, note)
  select id, v_order.id, 'credit', v_net, 'Wallet payment · #' || v_order.order_code from public.wallets where store_id = v_order.store_id;
  update public.orders
  set payment_status = 'paid', paid_at = now(), payment_total = v_order.total,
      escrow_status = 'released', commission = v_commission, net_to_seller = v_net,
      payment_reference = 'wallet-' || v_order.id::text
  where id = v_order.id;
  return jsonb_build_object('success', true, 'order_id', v_order.id, 'order_code', v_order.order_code, 'seller_net', v_net, 'commission', v_commission);
end;
$$;
grant execute on function public.pay_order_from_wallet(uuid) to authenticated;

-- Process deposits and order transfers using the independent live settings.
-- For an order transfer, the buyer-paid surcharge and provider costs are not
-- taken from the seller's goods total: seller net = order total - commission.
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
  v_setting jsonb;
  v_fee_rate numeric := 0;
  v_fee numeric(12,2) := 0;
  v_net_amount numeric(12,2) := 0;
  v_commission_rate numeric := 3;
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
    select value into v_setting from public.app_settings where key = 'deposit_fee_rate' limit 1;
    v_fee_rate := least(100, greatest(0, coalesce((v_setting->>'rate')::numeric, 1.5)));
    v_fee := round(p_amount * v_fee_rate / 100, 2);
    v_net_amount := greatest(0, round(p_amount - v_fee, 2));
    update public.buyer_wallets set balance = coalesce(v_buyer_wallet.balance, 0) + v_net_amount where id = v_buyer_wallet.id;
    insert into public.buyer_wallet_transactions(buyer_wallet_id, amount, label, provider_reference)
    values (v_buyer_wallet.id, v_net_amount, 'TransactPay wallet funding (' || trim(to_char(v_fee_rate, 'FM990D0#')) || '% fee deducted)', p_payment_reference);
    insert into public.notifications(user_id, type, title, body, link)
    values (v_buyer_wallet.user_id, 'wallet', 'Wallet funded', 'Your Sella wallet received NGN ' || to_char(v_net_amount, 'FM999,999,999,990.00') || '.', '/account/wallet');
    return jsonb_build_object('received', true, 'credited', 'buyer_wallet', 'wallet_id', v_buyer_wallet.id, 'user_id', v_buyer_wallet.user_id, 'amount', v_net_amount, 'gross_amount', p_amount, 'provider_fee', v_fee, 'fee_rate', v_fee_rate);
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
  select value into v_setting from public.app_settings where key = 'commission_rate' limit 1;
  v_commission_rate := least(100, greatest(0, coalesce((v_setting->>'rate')::numeric, 3)));
  v_commission := round(v_order.total * v_commission_rate / 100, 2);
  v_net := greatest(0, round(v_order.total - v_commission, 2));
  select * into v_wallet from public.wallets where store_id = v_order.store_id limit 1 for update;
  if v_wallet.id is null then
    insert into public.wallets(store_id, available, held) values (v_order.store_id, v_net, 0) returning * into v_wallet;
  else
    update public.wallets set available = coalesce(v_wallet.available, 0) + v_net, held = 0 where id = v_wallet.id returning * into v_wallet;
  end if;
  insert into public.wallet_transactions(wallet_id, order_id, kind, amount, note)
  values (v_wallet.id, v_order.id, 'credit', v_net, 'TransactPay order payment · #' || v_order.order_code);
  update public.orders
  set payment_status = 'paid', paid_at = now(), payment_expires_at = null,
      escrow_status = 'released', commission = v_commission, net_to_seller = v_net,
      payment_reference = coalesce(p_payment_reference, payment_reference)
  where id = v_order.id;
  insert into public.notifications(user_id, type, title, body, link)
  values (v_order.buyer_id, 'order', 'Payment confirmed', 'Payment for order #' || v_order.order_code || ' has been confirmed.', '/account/orders/' || v_order.id);
  insert into public.notifications(user_id, type, title, body, link)
  values (v_store.owner_id, 'order', 'Payment received', 'Payment for order #' || v_order.order_code || ' has been confirmed.', '/dashboard/orders?order=' || v_order.id);
  return jsonb_build_object('received', true, 'credited', 'seller_wallet', 'order_id', v_order.id, 'user_id', v_store.owner_id, 'amount', v_net, 'gross_amount', p_amount, 'commission', v_commission, 'required_amount', v_required);
end;
$$;
grant execute on function public.process_transactpay_webhook(text, jsonb, boolean, text, text, numeric, text, text) to anon, authenticated;

-- Expire an unpaid transfer order, restore its stock, and make it impossible
-- to pay after the 30-minute window.
create or replace function public.expire_unpaid_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  select * into v_order from public.orders where id = p_order_id and buyer_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.payment_status = 'paid' then return jsonb_build_object('expired', false, 'paid', true); end if;
  if v_order.payment_status <> 'unpaid' or v_order.status = 'cancelled' then return jsonb_build_object('expired', false, 'cancelled', true); end if;
  if v_order.payment_expires_at is null or v_order.payment_expires_at > now() then return jsonb_build_object('expired', false, 'expires_at', v_order.payment_expires_at); end if;
  for v_item in select product_id, quantity from public.order_items where order_id = v_order.id loop
    update public.products set stock = stock + v_item.quantity where id = v_item.product_id;
  end loop;
  update public.orders set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'Bank transfer payment window expired' where id = v_order.id;
  return jsonb_build_object('expired', true, 'order_id', v_order.id, 'order_code', v_order.order_code);
end;
$$;
grant execute on function public.expire_unpaid_order(uuid) to authenticated;

-- Capture the current admin-configured payout fee on each new withdrawal.
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
  v_setting jsonb;
  v_fee numeric(12,2) := 120;
  v_payout numeric(12,2);
begin
  if not exists(select 1 from public.stores where id = p_store_id and owner_id = auth.uid()) then raise exception 'Not authorised'; end if;
  select value into v_setting from public.app_settings where key = 'withdrawal_fee' limit 1;
  v_fee := greatest(0, coalesce((v_setting->>'amount')::numeric, 120));
  if p_amount <= v_fee then raise exception 'Withdrawal must be more than the current payout fee of ₦% ', to_char(v_fee, 'FM999,999,999,990.00'); end if;
  select * into v_wallet from public.wallets where store_id = p_store_id for update;
  if not found or coalesce(v_wallet.available, 0) < p_amount then raise exception 'Insufficient available balance'; end if;
  v_payout := round(p_amount - v_fee, 2);
  insert into public.withdrawals(store_id, amount, fee, payout_amount, bank_name, account_number, account_name, note)
  values(p_store_id, p_amount, v_fee, v_payout, p_bank_name, p_account_number, p_account_name, 'Payout fee deducted; seller receives ₦' || to_char(v_payout, 'FM999,999,999,990.00'))
  returning id into v_id;
  update public.wallets set available = available - p_amount, held = 0 where id = v_wallet.id;
  insert into public.wallet_transactions(wallet_id, kind, amount, note, status)
  values(v_wallet.id, 'withdrawal', -p_amount, 'Withdrawal request · fee ₦' || to_char(v_fee, 'FM999,999,999,990.00') || ' · payout ₦' || to_char(v_payout, 'FM999,999,999,990.00'), 'processing');
  return jsonb_build_object('id', v_id, 'requested_amount', p_amount, 'fee', v_fee, 'payout_amount', v_payout);
end;
$$;
grant execute on function public.request_store_withdrawal(uuid, numeric, text, text, text) to authenticated;

create or replace function public.get_public_payment_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'deposit_fee_rate', coalesce((select (value->>'rate')::numeric from public.app_settings where key = 'deposit_fee_rate' limit 1), 1.5),
    'bank_transfer_fee_rate', coalesce((select (value->>'rate')::numeric from public.app_settings where key = 'bank_transfer_fee_rate' limit 1), 0),
    'withdrawal_fee', coalesce((select (value->>'amount')::numeric from public.app_settings where key = 'withdrawal_fee' limit 1), 120)
  );
$$;
grant execute on function public.get_public_payment_settings() to anon, authenticated;

notify pgrst, 'reload schema';
