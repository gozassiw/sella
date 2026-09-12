-- Sella Stage 20: held seller accounts are no longer publicly discoverable.
drop policy if exists "stores: public read published" on public.stores;
create policy "stores: public read published" on public.stores
  for select using ((approval_status = 'pending') or (is_published and approval_status = 'approved' and not public.is_account_held(owner_id)) or owner_id = auth.uid());
notify pgrst, 'reload schema';
