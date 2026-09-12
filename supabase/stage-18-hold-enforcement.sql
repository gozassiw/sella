-- Sella Stage 18: enforce account holds on storefront visibility and checkout.
create or replace function public.store_can_accept_orders(p_store_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select public.store_can_operate(p_store_id);
$$;
grant execute on function public.store_can_accept_orders(uuid) to anon, authenticated;

drop policy if exists "products: public read active" on public.products;
create policy "products: public read active" on public.products
  for select using (is_active and public.store_can_operate(store_id));

notify pgrst, 'reload schema';
