-- Sella Stage 2: buyer checkout, payment metadata, buyer RLS, and atomic checkout functions.
-- Run schema.sql, sella-schema-additions.sql, then this file.

alter table public.orders
  add column if not exists buyer_id uuid references auth.users(id) on delete set null,
  add column if not exists payment_method text not null default 'transfer' check (payment_method in ('wallet','transfer')),
  add column if not exists payment_reference text,
  add column if not exists payment_account_number text,
  add column if not exists payment_account_name text,
  add column if not exists payment_bank_name text,
  add column if not exists paid_at timestamptz;
create unique index if not exists orders_payment_reference_idx on public.orders(payment_reference) where payment_reference is not null;

alter table public.buyer_wallets
  add column if not exists dedicated_account_name text,
  add column if not exists dedicated_bank_name text,
  add column if not exists dedicated_account_reference text;

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_key text not null unique,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
alter table public.payment_webhook_events enable row level security;

create policy "orders: buyer read own" on public.orders for select using (buyer_id = auth.uid());
create policy "order_items: buyer read own" on public.order_items for select using (exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid()));

-- The checkout function validates stock under row locks, creates the customer/order/items,
-- and decrements stock in one transaction. It can only be called for the current user.
create or replace function public.create_checkout_order(p_store_id uuid, p_buyer_id uuid, p_items jsonb, p_customer jsonb, p_fulfilment_method text, p_payment_method text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order_id uuid; v_customer_id uuid; v_subtotal numeric(12,2) := 0; v_item jsonb; v_product public.products%rowtype; v_qty integer; v_total numeric(12,2); v_order_number bigint; v_updated integer;
begin
  if auth.uid() is null or auth.uid() <> p_buyer_id then raise exception 'Not authorised'; end if;
  if p_fulfilment_method not in ('pickup','delivery') then raise exception 'Invalid fulfilment method'; end if;
  if p_payment_method not in ('wallet','transfer') then raise exception 'Invalid payment method'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty'; end if;
  insert into public.customers(store_id, name, phone, email, address)
    values (p_store_id, coalesce(nullif(trim(p_customer->>'name'), ''), 'Buyer'), nullif(trim(p_customer->>'phone'), ''), nullif(trim(p_customer->>'email'), ''), case when p_fulfilment_method = 'delivery' then nullif(trim(p_customer->>'address'), '') else 'pickup' end)
    returning id into v_customer_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id = (v_item->>'productId')::uuid and store_id = p_store_id and is_active = true for update;
    if not found then raise exception 'Product is unavailable'; end if;
    v_qty := greatest(1, (v_item->>'quantity')::integer);
    if v_product.stock < v_qty then raise exception 'Not enough stock for %', v_product.name; end if;
    v_subtotal := v_subtotal + (v_product.price * v_qty);
  end loop;
  v_total := v_subtotal;
  insert into public.orders(store_id, customer_id, buyer_id, channel, status, payment_status, subtotal, delivery_fee, total, fulfilment_method, delivery_code, payment_method, escrow_status)
    values (p_store_id, v_customer_id, p_buyer_id, 'website', 'pending', 'unpaid', v_subtotal, 0, v_total, p_fulfilment_method, lpad((floor(random() * 10000))::text, 4, '0'), p_payment_method, 'held')
    returning id, order_number into v_order_id, v_order_number;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id = (v_item->>'productId')::uuid and store_id = p_store_id;
    v_qty := greatest(1, (v_item->>'quantity')::integer);
    update public.products set stock = stock - v_qty where id = v_product.id and stock >= v_qty;
    get diagnostics v_updated = row_count;
    if v_updated <> 1 then raise exception 'Not enough stock for %', v_product.name; end if;
    insert into public.order_items(order_id, product_id, name, price, quantity) values (v_order_id, v_product.id, v_product.name, v_product.price, v_qty);
  end loop;
  return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'total', v_total);
end; $$;
grant execute on function public.create_checkout_order(uuid, uuid, jsonb, jsonb, text, text) to authenticated;

create or replace function public.pay_order_from_wallet(p_order_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype; v_wallet public.buyer_wallets%rowtype; v_store public.stores%rowtype; v_commission numeric(12,2); v_net numeric(12,2); v_is_trusted boolean;
begin
  select * into v_order from public.orders where id = p_order_id and buyer_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.payment_status <> 'unpaid' then raise exception 'Order is already paid'; end if;
  select * into v_wallet from public.buyer_wallets where user_id = auth.uid() for update;
  if not found or v_wallet.balance < v_order.total then raise exception 'Insufficient wallet balance'; end if;
  select * into v_store from public.stores where id = v_order.store_id;
  v_is_trusted := coalesce(v_store.trusted, false);
  v_commission := round(v_order.total * 0.05, 2);
  v_net := v_order.total - v_commission;
  update public.buyer_wallets set balance = balance - v_order.total where id = v_wallet.id;
  insert into public.buyer_wallet_transactions(buyer_wallet_id, order_id, amount, label) values (v_wallet.id, v_order.id, -v_order.total, 'Payment for order #' || v_order.order_number);
  insert into public.wallets(store_id, available, held) values (v_order.store_id, case when v_is_trusted then v_net else 0 end, case when v_is_trusted then 0 else v_net end)
    on conflict (store_id) do update set held = wallets.held + excluded.held, available = wallets.available + excluded.available;
  insert into public.wallet_transactions(wallet_id, order_id, kind, amount, note) select id, v_order.id, case when v_is_trusted then 'credit' else 'hold' end, v_net, 'Wallet payment for order #' || v_order.order_number from public.wallets where store_id = v_order.store_id;
  update public.orders set payment_status = 'paid', paid_at = now(), escrow_status = case when v_is_trusted then 'released' else 'held' end, commission = v_commission, net_to_seller = v_net, payment_reference = 'wallet-' || v_order.id::text where id = v_order.id;
  return jsonb_build_object('success', true, 'order_id', v_order.id);
end; $$;
grant execute on function public.pay_order_from_wallet(uuid) to authenticated;

-- Supabase SQL Editor-created tables need explicit grants in addition to RLS.
-- RLS still limits each authenticated user to their own store and records.
grant select on public.stores, public.products to anon;
grant select, insert, update, delete on public.stores, public.products, public.customers, public.orders, public.order_items, public.expenses, public.wallets, public.wallet_transactions, public.reports, public.subscriptions, public.payment_webhook_events to authenticated;
grant usage, select on all sequences in schema public to authenticated;
