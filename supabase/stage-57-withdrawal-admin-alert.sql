-- Sella Stage 57: guarantee an in-app admin alert for every seller withdrawal request.
-- The trigger covers all callers of request_store_withdrawal, not only the web route.

create or replace function public.notify_new_withdrawal_admins()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_store_name text;
begin
  select name into v_store_name from public.stores where id = new.store_id;
  perform public.notify_platform_admins(
    'withdrawal',
    'New withdrawal request',
    coalesce(v_store_name, 'A seller') || ' requested a withdrawal of ₦' || to_char(new.amount, 'FM999,999,999,990.00') || '.',
    '/admin?section=withdrawals'
  );
  return new;
end;
$$;

drop trigger if exists withdrawals_notify_platform_admins on public.withdrawals;
create trigger withdrawals_notify_platform_admins
after insert on public.withdrawals
for each row execute function public.notify_new_withdrawal_admins();

notify pgrst, 'reload schema';
