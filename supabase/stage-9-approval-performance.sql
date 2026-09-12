-- Sella Stage 9: seller approval workflow and query indexes.
-- New stores are pending and private until an admin approves them.

alter table public.stores
  add column if not exists approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists trial_starts_at timestamptz;

update public.stores
set approval_status = case when is_published then 'approved' else 'pending' end,
    approved_at = case when is_published then coalesce(approved_at, created_at) else approved_at end,
    trial_starts_at = case when is_published then coalesce(trial_starts_at, created_at) else trial_starts_at end,
    trial_ends_at = case when is_published then greatest(trial_ends_at, coalesce(trial_starts_at, created_at) + interval '10 days') else trial_ends_at end;

alter table public.stores alter column is_published set default false;

create index if not exists stores_approval_idx on public.stores(approval_status, is_published, created_at desc);
create index if not exists products_store_active_created_idx on public.products(store_id, is_active, created_at desc);
create index if not exists orders_store_status_created_idx on public.orders(store_id, status, created_at desc);
create index if not exists orders_buyer_created_idx on public.orders(buyer_id, created_at desc);
create index if not exists follows_user_created_idx on public.buyer_store_follows(user_id, created_at desc);
create extension if not exists pg_trgm;
create index if not exists stores_name_search_idx on public.stores using gin (name gin_trgm_ops);

-- This function is called by checkout before stock reservation. Pending and rejected stores cannot take orders.
create or replace function public.store_can_accept_orders(p_store_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.stores where id = p_store_id and approval_status = 'approved' and is_published = true);
$$;
grant execute on function public.store_can_accept_orders(uuid) to anon, authenticated;

-- Trial clock starts at approval, not at sign-up.

-- Prevent checkout from bypassing the approval gate.
create or replace function public.create_checkout_order(p_store_id uuid, p_buyer_id uuid, p_items jsonb, p_customer jsonb, p_fulfilment_method text, p_payment_method text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order_id uuid; v_customer_id uuid; v_subtotal numeric(12,2) := 0; v_item jsonb; v_product public.products%rowtype; v_qty integer; v_total numeric(12,2); v_order_number bigint; v_updated integer;
begin
  if auth.uid() is null or auth.uid() <> p_buyer_id then raise exception 'Not authorised'; end if;
  if not public.store_can_accept_orders(p_store_id) then raise exception 'This store is awaiting approval and cannot take orders yet'; end if;
  if p_fulfilment_method not in ('pickup','delivery') then raise exception 'Invalid fulfilment method'; end if;
  if p_payment_method not in ('wallet','transfer') then raise exception 'Invalid payment method'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty'; end if;
  insert into public.customers(store_id, name, phone, email, address) values (p_store_id, coalesce(nullif(trim(p_customer->>'name'), ''), 'Buyer'), nullif(trim(p_customer->>'phone'), ''), nullif(trim(p_customer->>'email'), ''), case when p_fulfilment_method = 'delivery' then nullif(trim(p_customer->>'address'), '') else 'pickup' end) returning id into v_customer_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id = (v_item->>'productId')::uuid and store_id = p_store_id and is_active = true for update;
    if not found then raise exception 'Product is unavailable'; end if;
    v_qty := greatest(1, (v_item->>'quantity')::integer);
    if v_product.stock < v_qty then raise exception 'Not enough stock for %', v_product.name; end if;
    v_subtotal := v_subtotal + (v_product.price * v_qty);
  end loop;
  v_total := v_subtotal;
  insert into public.orders(store_id, customer_id, buyer_id, channel, status, payment_status, subtotal, delivery_fee, total, fulfilment_method, delivery_code, payment_method, escrow_status) values (p_store_id, v_customer_id, p_buyer_id, 'website', 'pending', 'unpaid', v_subtotal, 0, v_total, p_fulfilment_method, lpad((floor(random() * 10000))::text, 4, '0'), p_payment_method, 'held') returning id, order_number into v_order_id, v_order_number;
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

-- Sellers may edit setup fields while pending, but cannot publish or self-approve.
create or replace function public.enforce_store_approval() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'authenticated' and tg_op = 'INSERT' then
    new.approval_status := 'pending';
    new.is_published := false;
    new.approved_at := null;
    new.rejected_at := null;
    new.rejection_reason := null;
    new.trial_starts_at := null;
  elsif auth.role() = 'authenticated' and tg_op = 'UPDATE' and new.approval_status is distinct from old.approval_status then
    new.approval_status := old.approval_status;
    new.approved_at := old.approved_at;
    new.rejected_at := old.rejected_at;
    new.rejection_reason := old.rejection_reason;
    new.trial_starts_at := old.trial_starts_at;
    new.trial_ends_at := old.trial_ends_at;
  end if;
  if new.approval_status <> 'approved' then new.is_published := false; end if;
  return new;
end; $$;
drop trigger if exists stores_approval_guard on public.stores;
create trigger stores_approval_guard before insert or update on public.stores for each row execute function public.enforce_store_approval();

-- Defence in depth: public reads require both publication and approval.
drop policy if exists "stores: public read published" on public.stores;
create policy "stores: public read published" on public.stores for select using ((is_published and approval_status = 'approved') or owner_id = auth.uid());
drop policy if exists "products: public read active" on public.products;
create policy "products: public read active" on public.products for select using (is_active and exists (select 1 from public.stores s where s.id = store_id and s.is_published and s.approval_status = 'approved'));
