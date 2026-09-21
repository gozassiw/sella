-- Sella Stage 81: consolidate Seller overview reads into one protected RPC.

create or replace function public.get_seller_dashboard_snapshot(p_store_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  with owned_store as (
    select s.id, s.owner_id
    from public.stores s
    where s.id = p_store_id
      and s.owner_id = auth.uid()
    limit 1
  ),
  recent_orders as (
    select jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'order_code', o.order_code,
        'total', o.total,
        'status', o.status,
        'payment_status', o.payment_status,
        'created_at', o.created_at,
        'customers', case when c.id is null then null else jsonb_build_object('name', c.name) end
      ) order by o.created_at desc
    ) as rows
    from (
      select *
      from public.orders
      where store_id = p_store_id
      order by created_at desc
      limit 5
    ) o
    left join public.customers c on c.id = o.customer_id
  ),
  low_stock_products as (
    select jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'stock', p.stock,
        'price', p.price,
        'image_urls', p.image_urls
      ) order by p.stock asc
    ) as rows
    from (
      select id, name, stock, price, image_urls
      from public.products
      where store_id = p_store_id
        and is_active = true
        and stock <= 3
      order by stock asc
      limit 5
    ) p
  ),
  refund_rows as (
    select coalesce(
      jsonb_agg(
        to_jsonb(r)
        || jsonb_build_object(
          'order_code', o.order_code,
          'buyer_name', coalesce(c.name, 'Buyer'),
          'linked_withdrawal_status', w.status
        ) order by r.created_at desc
      ),
      '[]'::jsonb
    ) as rows
    from public.refund_obligations r
    join public.orders o on o.id = r.order_id
    left join public.customers c on c.id = o.customer_id
    left join public.withdrawals w on w.id = r.linked_withdrawal_id
    where r.store_id = p_store_id
      and r.refund_status <> 'refunded'
  )
  select case when exists (select 1 from owned_store) then jsonb_build_object(
    'product_count', (select count(*) from public.products p where p.store_id = p_store_id and p.is_active = true),
    'low_stock_count', (select count(*) from public.products p where p.store_id = p_store_id and p.is_active = true and p.stock <= 3),
    'open_order_count', (select count(*) from public.orders o where o.store_id = p_store_id and o.status in ('pending', 'processing', 'shipped')),
    'recent_orders', coalesce((select rows from recent_orders), '[]'::jsonb),
    'wallet', (select case when w.id is null then null else jsonb_build_object('available', w.available) end from public.wallets w where w.store_id = p_store_id limit 1),
    'active_subscription', (select case when s.id is null then null else jsonb_build_object('plan', s.plan, 'expires_at', s.expires_at, 'status', s.status) end from public.subscriptions s where s.store_id = p_store_id and s.status in ('paid', 'active') and s.expires_at > now() order by s.expires_at desc limit 1),
    'metrics', (select jsonb_build_object('paid_sales', coalesce(sum(o.total) filter (where o.payment_status = 'paid'), 0), 'paid_orders', count(*) filter (where o.payment_status = 'paid')) from public.orders o where o.store_id = p_store_id),
    'low_stock_products', coalesce((select rows from low_stock_products), '[]'::jsonb),
    'refund_rows', (select rows from refund_rows)
  ) else null end;
$$;

revoke all on function public.get_seller_dashboard_snapshot(uuid) from public, anon;
grant execute on function public.get_seller_dashboard_snapshot(uuid) to authenticated;
