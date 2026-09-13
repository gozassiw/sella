-- Sella Stage 55: align withdrawal status constraint with the admin processing workflow.
-- Keep legacy sent rows readable while allowing the current processing/paid flow.

alter table public.withdrawals
  drop constraint if exists withdrawals_status_check;

alter table public.withdrawals
  add constraint withdrawals_status_check
  check (status = any (array['pending'::text, 'processing'::text, 'paid'::text, 'sent'::text, 'rejected'::text]));

create or replace function public.notify_withdrawal_owner(p_withdrawal_id uuid, p_status text)
returns integer language plpgsql security definer set search_path = public, auth as $$
declare
  v_owner_id uuid;
  v_amount numeric;
  v_status text := lower(trim(coalesce(p_status, '')));
  v_title text;
  v_body text;
begin
  if not public.is_platform_admin() then raise exception 'Admin access required'; end if;
  if v_status not in ('processing', 'paid', 'sent', 'rejected') then raise exception 'Invalid withdrawal notification status'; end if;
  select s.owner_id, w.amount into v_owner_id, v_amount
  from public.withdrawals w
  join public.stores s on s.id = w.store_id
  where w.id = p_withdrawal_id;
  if v_owner_id is null then raise exception 'Withdrawal not found'; end if;
  if v_status in ('paid', 'sent') then
    v_title := 'Withdrawal processed';
    v_body := 'Your NGN ' || to_char(v_amount, 'FM999,999,999,990.00') || ' withdrawal has been paid.';
  elsif v_status = 'processing' then
    v_title := 'Withdrawal processing';
    v_body := 'Sella is processing your NGN ' || to_char(v_amount, 'FM999,999,999,990.00') || ' withdrawal request.';
  else
    v_title := 'Withdrawal cancelled';
    v_body := 'Your withdrawal request was cancelled by Sella Team and the amount was returned to your seller balance.';
  end if;
  insert into public.notifications(user_id, type, title, body, link)
  values (v_owner_id, 'withdrawal', v_title, v_body, '/dashboard/wallet');
  return 1;
end;
$$;
grant execute on function public.notify_withdrawal_owner(uuid, text) to authenticated;
