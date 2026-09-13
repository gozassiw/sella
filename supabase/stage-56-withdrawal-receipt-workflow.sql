-- Sella Stage 56: protected withdrawal receipt workflow.
-- Receipt upload uses security-definer RPCs instead of direct withdrawals table access.
-- A withdrawal cannot move to paid until a receipt path is attached.

create or replace function public.admin_get_withdrawal_receipt_target(p_withdrawal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_target record;
begin
  if not public.is_platform_admin() then raise exception 'Admin access required'; end if;
  select w.id, w.status, w.receipt_path, w.receipt_name, s.owner_id, s.name as store_name
  into v_target
  from public.withdrawals w
  join public.stores s on s.id = w.store_id
  where w.id = p_withdrawal_id;
  if not found then raise exception 'Withdrawal request not found'; end if;
  return jsonb_build_object(
    'id', v_target.id,
    'status', v_target.status,
    'receipt_path', v_target.receipt_path,
    'receipt_name', v_target.receipt_name,
    'owner_id', v_target.owner_id,
    'store_name', v_target.store_name
  );
end;
$$;
grant execute on function public.admin_get_withdrawal_receipt_target(uuid) to authenticated;

create or replace function public.admin_attach_withdrawal_receipt(
  p_withdrawal_id uuid,
  p_receipt_path text,
  p_receipt_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_status text;
begin
  if not public.is_platform_admin() then raise exception 'Admin access required'; end if;
  select status into v_status from public.withdrawals where id = p_withdrawal_id for update;
  if not found then raise exception 'Withdrawal request not found'; end if;
  if v_status not in ('pending', 'processing', 'paid', 'sent') then raise exception 'This withdrawal cannot accept a receipt in its current status'; end if;
  if nullif(trim(coalesce(p_receipt_path, '')), '') is null then raise exception 'Receipt path is required'; end if;
  update public.withdrawals
  set receipt_path = nullif(trim(p_receipt_path), ''),
      receipt_name = nullif(trim(p_receipt_name), ''),
      receipt_uploaded_at = now()
  where id = p_withdrawal_id;
  return jsonb_build_object('success', true, 'id', p_withdrawal_id);
end;
$$;
grant execute on function public.admin_attach_withdrawal_receipt(uuid, text, text) to authenticated;

create or replace function public.admin_process_withdrawal(
  p_withdrawal_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_withdrawal public.withdrawals%rowtype;
  v_store public.stores%rowtype;
  v_wallet public.wallets%rowtype;
  v_status text := lower(trim(coalesce(p_status, '')));
  v_refunded boolean := false;
begin
  if not public.is_platform_admin() then raise exception 'Admin access required'; end if;
  if v_status not in ('processing', 'paid', 'rejected') then raise exception 'Withdrawal status must be processing, paid, or rejected'; end if;

  select * into v_withdrawal from public.withdrawals where id = p_withdrawal_id for update;
  if not found then raise exception 'Withdrawal request not found'; end if;
  if v_withdrawal.status = 'rejected' and v_status = 'paid' then raise exception 'A cancelled withdrawal cannot be marked paid'; end if;
  if v_status = 'paid' and nullif(trim(coalesce(v_withdrawal.receipt_path, '')), '') is null then raise exception 'Upload the withdrawal receipt before marking it paid'; end if;

  select * into v_store from public.stores where id = v_withdrawal.store_id limit 1;
  if not found then raise exception 'Store not found'; end if;

  if v_status = 'rejected' and v_withdrawal.status not in ('rejected', 'paid', 'sent') then
    select * into v_wallet from public.wallets where store_id = v_withdrawal.store_id for update;
    if found then
      update public.wallets set available = coalesce(available, 0) + v_withdrawal.amount where id = v_wallet.id;
      insert into public.wallet_transactions(wallet_id, kind, amount, note, status)
      values (v_wallet.id, 'credit', v_withdrawal.amount, 'Withdrawal cancelled and returned to seller balance', 'completed');
      v_refunded := true;
    end if;
  end if;

  update public.withdrawals
  set status = v_status,
      note = coalesce(nullif(trim(p_note), ''), case when v_status = 'rejected' then 'Withdrawal cancelled by Sella Team.' else note end),
      processed_at = case when v_status in ('paid', 'rejected') then now() else processed_at end
  where id = v_withdrawal.id;

  insert into public.admin_audit_logs(admin_user_id, action, entity, entity_id, details)
  values (auth.uid(), 'withdrawal_status', 'withdrawal', v_withdrawal.id,
    jsonb_build_object('status', v_status, 'refunded', v_refunded, 'note', p_note, 'receipt_attached', nullif(trim(coalesce(v_withdrawal.receipt_path, '')), '') is not null));

  return jsonb_build_object('success', true, 'id', v_withdrawal.id, 'status', v_status, 'owner_id', v_store.owner_id, 'store_name', v_store.name, 'amount', v_withdrawal.amount, 'payout_amount', v_withdrawal.payout_amount, 'refunded', v_refunded);
end;
$$;
grant execute on function public.admin_process_withdrawal(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
