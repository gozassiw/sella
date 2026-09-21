-- Sella Stage 80: dashboard performance.
-- Replace large client-side seller sales reads with one protected aggregate RPC
-- and add compound indexes for the dashboard filters.

create index if not exists orders_store_payment_status_idx
  on public.orders(store_id, payment_status, created_at desc);

create index if not exists products_store_active_stock_idx
  on public.products(store_id, is_active, stock);

create index if not exists products_store_active_created_idx
  on public.products(store_id, is_active, created_at desc);

create index if not exists buyer_store_follows_user_created_idx
  on public.buyer_store_follows(user_id, created_at desc);

create or replace function public.get_seller_dashboard_metrics(p_store_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'paid_sales', coalesce(sum(o.total) filter (where o.payment_status = 'paid'), 0),
    'paid_orders', count(*) filter (where o.payment_status = 'paid')
  )
  from public.orders o
  where o.store_id = p_store_id
    and exists (
      select 1
      from public.stores s
      where s.id = p_store_id
        and s.owner_id = auth.uid()
    );
$$;

revoke all on function public.get_seller_dashboard_metrics(uuid) from public, anon;
grant execute on function public.get_seller_dashboard_metrics(uuid) to authenticated;
