-- Sella Stage 31: in-platform delivery sharing.
-- Keep delivery call and WhatsApp details on the customer record attached to each order.

alter table public.customers add column if not exists whatsapp text;

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

  insert into public.customers(store_id, name, phone, whatsapp, email, address)
    values (p_store_id, coalesce(nullif(trim(p_customer->>'name'), ''), 'Buyer'), nullif(trim(p_customer->>'phone'), ''), nullif(trim(p_customer->>'whatsapp'), ''), nullif(trim(p_customer->>'email'), ''), case when p_fulfilment_method = 'delivery' then nullif(trim(p_customer->>'address'), '') else 'pickup' end)
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
notify pgrst, 'reload schema';
