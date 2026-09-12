-- Sella Stage 19: seller-owned write gates.

drop policy if exists "customers: owner manage" on public.customers;
create policy "customers: owner manage" on public.customers for all using (public.store_can_operate(store_id)) with check (public.store_can_operate(store_id));

drop policy if exists "orders: owner manage" on public.orders;
create policy "orders: owner manage" on public.orders for all using (public.store_can_operate(store_id)) with check (public.store_can_operate(store_id));

drop policy if exists "order_items: owner manage" on public.order_items;
create policy "order_items: owner manage" on public.order_items for all using (exists (select 1 from public.orders o where o.id = order_id and public.store_can_operate(o.store_id))) with check (exists (select 1 from public.orders o where o.id = order_id and public.store_can_operate(o.store_id)));

drop policy if exists "expenses: owner manage" on public.expenses;
create policy "expenses: owner manage" on public.expenses for all using (public.store_can_operate(store_id)) with check (public.store_can_operate(store_id));

notify pgrst, 'reload schema';
