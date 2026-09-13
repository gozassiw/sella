-- Sella Stage 51: withdrawal processing, cancellation refunds, and private receipts.

alter table public.withdrawals
  add column if not exists receipt_path text,
  add column if not exists receipt_name text,
  add column if not exists receipt_uploaded_at timestamptz;

insert into storage.buckets (id, name, public)
values ('withdrawal-receipts', 'withdrawal-receipts', false)
on conflict (id) do update set public = false;

-- Receipts are uploaded and signed by server routes. These policies prevent
-- direct public reads while still documenting the intended owner/admin access.
drop policy if exists "withdrawal receipts owner read" on storage.objects;
create policy "withdrawal receipts owner read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'withdrawal-receipts'
  and exists (
    select 1
    from public.withdrawals w
    join public.stores s on s.id = w.store_id
    where w.receipt_path = storage.objects.name
      and (s.owner_id = auth.uid() or public.is_platform_admin())
  )
);

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
  if not public.is_platform_admin() then
    raise exception 'Admin access required';
  end if;
  if v_status not in ('processing', 'paid', 'rejected') then
    raise exception 'Withdrawal status must be processing, paid, or rejected';
  end if;

  select * into v_withdrawal
  from public.withdrawals
  where id = p_withdrawal_id
  for update;
  if not found then raise exception 'Withdrawal request not found'; end if;

  if v_withdrawal.status = 'rejected' and v_status = 'paid' then
    raise exception 'A cancelled withdrawal cannot be marked paid';
  end if;

  select * into v_store from public.stores where id = v_withdrawal.store_id limit 1;
  if not found then raise exception 'Store not found'; end if;

  -- A pending/processing request has already reduced available balance. If
  -- Admin cancels it, return the full requested amount exactly once.
  if v_status = 'rejected' and v_withdrawal.status not in ('rejected', 'paid', 'sent') then
    select * into v_wallet from public.wallets where store_id = v_withdrawal.store_id for update;
    if found then
      update public.wallets
      set available = coalesce(available, 0) + v_withdrawal.amount
      where id = v_wallet.id;
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
    jsonb_build_object('status', v_status, 'refunded', v_refunded, 'note', p_note));

  return jsonb_build_object(
    'success', true,
    'id', v_withdrawal.id,
    'status', v_status,
    'owner_id', v_store.owner_id,
    'store_name', v_store.name,
    'amount', v_withdrawal.amount,
    'payout_amount', v_withdrawal.payout_amount,
    'refunded', v_refunded
  );
end;
$$;
grant execute on function public.admin_process_withdrawal(uuid, text, text) to authenticated;

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
  if v_status not in ('paid', 'sent') then raise exception 'Mark the withdrawal paid before uploading a receipt'; end if;
  update public.withdrawals
  set receipt_path = nullif(trim(p_receipt_path), ''),
      receipt_name = nullif(trim(p_receipt_name), ''),
      receipt_uploaded_at = now()
  where id = p_withdrawal_id;
  return jsonb_build_object('success', true, 'id', p_withdrawal_id);
end;
$$;
grant execute on function public.admin_attach_withdrawal_receipt(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
