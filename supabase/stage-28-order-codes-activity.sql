-- Sella Stage 28: buyer-facing order codes and linked wallet activity.
-- Keep the existing numeric order_number for backwards-compatible internal data,
-- but use order_code everywhere customers and sellers see an order reference.

alter table public.orders add column if not exists order_code text;

update public.orders
set order_code = upper(substr(md5(id::text), 1, 8))
where order_code is null or length(order_code) <> 8;

alter table public.orders
  alter column order_code set default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  alter column order_code set not null;

create unique index if not exists orders_order_code_idx on public.orders(order_code);

create or replace function public.create_checkout_order(
  p_store_id uuid,
  p_buyer_id uuid,
  p_items jsonb,
  p_customer jsonb,
  p_fulfilment_method text,
  p_payment_method text
)
returns jsonb language plpgsql security definer set search_path = public as $$
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
    returning id, order_code into v_order_id, v_order_code;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id = (v_item->>'productId')::uuid and store_id = p_store_id;
    v_qty := greatest(1, (v_item->>'quantity')::integer);
    update public.products set stock = stock - v_qty where id = v_product.id and stock >= v_qty;
    get diagnostics v_updated = row_count;
    if v_updated <> 1 then raise exception 'Not enough stock for %', v_product.name; end if;
    insert into public.order_items(order_id, product_id, name, price, quantity) values (v_order_id, v_product.id, v_product.name, v_product.price, v_qty);
  end loop;

  return jsonb_build_object('id', v_order_id, 'order_code', v_order_code, 'total', v_total);
end;
$$;

grant execute on function public.create_checkout_order(uuid, uuid, jsonb, jsonb, text, text) to authenticated;

create or replace function public.pay_order_from_wallet(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_wallet public.buyer_wallets%rowtype;
  v_store public.stores%rowtype;
  v_commission numeric(12,2);
  v_net numeric(12,2);
  v_is_trusted boolean;
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
  insert into public.buyer_wallet_transactions(buyer_wallet_id, order_id, amount, label)
    values (v_wallet.id, v_order.id, -v_order.total, 'Order payment · #' || v_order.order_code);
  insert into public.wallets(store_id, available, held)
    values (v_order.store_id, case when v_is_trusted then v_net else 0 end, case when v_is_trusted then 0 else v_net end)
    on conflict (store_id) do update set held = wallets.held + excluded.held, available = wallets.available + excluded.available;
  insert into public.wallet_transactions(wallet_id, order_id, kind, amount, note)
    select id, v_order.id, case when v_is_trusted then 'credit' else 'hold' end, v_net, 'Wallet payment · #' || v_order.order_code
    from public.wallets where store_id = v_order.store_id;
  update public.orders
    set payment_status = 'paid', paid_at = now(), escrow_status = case when v_is_trusted then 'released' else 'held' end,
        commission = v_commission, net_to_seller = v_net, payment_reference = 'wallet-' || v_order.id::text
    where id = v_order.id;

  return jsonb_build_object('success', true, 'order_id', v_order.id, 'order_code', v_order.order_code);
end;
$$;

grant execute on function public.pay_order_from_wallet(uuid) to authenticated;
notify pgrst, 'reload schema';
