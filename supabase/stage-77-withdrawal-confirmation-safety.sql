-- Sella: manual payout safeguards. No new holds, fees, escrow, or balance architecture.
-- Bank settlement is checked by an authorised administrator in their bank/provider channel.
-- These fields record that check; this is NOT an automated bank verification integration.
alter table public.withdrawals add column if not exists settlement_checked_by uuid references auth.users(id);
alter table public.withdrawals add column if not exists settlement_checked_at timestamptz;
alter table public.withdrawals add column if not exists settlement_channel text;
alter table public.withdrawals add column if not exists settlement_reference text;
alter table public.withdrawals add column if not exists settlement_paid_at timestamptz;
alter table public.withdrawals add column if not exists cancellation_checked_by uuid references auth.users(id);
alter table public.withdrawals add column if not exists cancellation_checked_at timestamptz;
create unique index if not exists withdrawal_settlement_reference_unique on public.withdrawals(lower(settlement_channel), lower(settlement_reference)) where settlement_reference is not null;

-- Mutations are through role-checked SECURITY DEFINER routines, not direct table writes.
revoke insert,update,delete,truncate,references,trigger on public.withdrawals from anon,authenticated;

create or replace function public.guard_withdrawal_transition()
returns trigger language plpgsql set search_path = public,pg_temp as $$
begin
  if new.status is distinct from old.status then
    if current_setting('sella.withdrawal_action',true) is distinct from 'review-v2' then
      raise exception 'Use the reviewed withdrawal action to change payout status';
    end if;
    if old.status in ('rejected','paid','sent') then raise exception 'Final withdrawals cannot be reopened'; end if;
    if new.status not in ('processing','paid','rejected') then raise exception 'Invalid withdrawal transition'; end if;
    if new.status='paid' and (old.status <> 'processing' or new.settlement_checked_by is null or new.settlement_checked_at is null or new.settlement_reference is null or new.receipt_path is null) then
      raise exception 'Confirm successful settlement in the banking channel before completing payout';
    end if;
    if new.status='rejected' and new.cancellation_checked_by is null then raise exception 'Confirm the payout was not settled before cancellation'; end if;
  end if;
  if (new.amount,new.fee,new.payout_amount,new.store_id,new.bank_name,new.account_number,new.account_name) is distinct from (old.amount,old.fee,old.payout_amount,old.store_id,old.bank_name,old.account_number,old.account_name) then
    raise exception 'Withdrawal financial and destination details cannot be edited';
  end if;
  if (new.settlement_checked_by,new.settlement_checked_at,new.settlement_channel,new.settlement_reference,new.settlement_paid_at,new.cancellation_checked_by,new.cancellation_checked_at) is distinct from (old.settlement_checked_by,old.settlement_checked_at,old.settlement_channel,old.settlement_reference,old.settlement_paid_at,old.cancellation_checked_by,old.cancellation_checked_at)
    and current_setting('sella.withdrawal_action',true) is distinct from 'review-v2' then
    raise exception 'Settlement checks must be recorded through the reviewed payout action';
  end if;
  return new;
end $$;
drop trigger if exists withdrawal_transition_guard on public.withdrawals;
create trigger withdrawal_transition_guard before update on public.withdrawals for each row execute function public.guard_withdrawal_transition();

create or replace function public.admin_review_withdrawal(p_withdrawal_id uuid,p_status text,p_confirmation jsonb default '{}'::jsonb,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare
 w public.withdrawals%rowtype; v_wallet_id uuid; v_owner uuid; v_status text:=lower(trim(p_status));
 v_amount numeric; v_channel text; v_reference text; v_paid_at timestamptz;
begin
 if not public.is_platform_admin() or auth.uid() is null then raise exception 'Admin access required'; end if;
 if v_status is null or v_status not in ('processing','paid','rejected') then raise exception 'Invalid payout status'; end if;
 select * into w from public.withdrawals where id=p_withdrawal_id for update;
 if not found then raise exception 'Withdrawal not found'; end if;
 select owner_id into v_owner from public.stores where id=w.store_id;
 if w.status=v_status then return jsonb_build_object('success',true,'changed',false,'id',w.id,'owner_id',v_owner); end if;
 if w.status in ('paid','sent','rejected') then raise exception 'Final withdrawals cannot be reopened or changed'; end if;
 if w.status not in ('pending','processing') then raise exception 'Invalid current withdrawal status'; end if;
 if length(coalesce(p_note,''))>2000 then raise exception 'Keep the audit note under 2000 characters'; end if;
 if v_status='processing' and w.status <> 'pending' then raise exception 'Only pending withdrawals can enter review'; end if;
 -- No new financial restriction mechanism is activated here. Requires provider agreement review.
 if v_status='paid' then
   if w.status <> 'processing' then raise exception 'Review the payout before confirming settlement'; end if;
   if nullif(w.receipt_path,'') is null then raise exception 'Attach the payment record before completion'; end if;
   if p_confirmation->'bank_success_checked' is distinct from 'true'::jsonb then raise exception 'Check successful settlement in the bank/provider channel first'; end if;
   v_channel:=nullif(trim(p_confirmation->>'channel'),''); v_reference:=nullif(trim(p_confirmation->>'reference'),'');
   v_paid_at:=(p_confirmation->>'paid_at')::timestamptz; v_amount:=(p_confirmation->>'amount')::numeric;
   if v_channel is null or length(v_channel)>120 or v_reference is null or length(v_reference)>180 then raise exception 'Banking channel and settlement reference are required'; end if;
   if v_paid_at is null or v_paid_at<w.created_at or v_paid_at>now()+interval '5 minutes' then raise exception 'Enter the actual successful payment date'; end if;
   if v_amount is null or v_amount<>coalesce(w.payout_amount,w.amount-coalesce(w.fee,0)) then raise exception 'Confirmed paid amount must equal the requested net payout'; end if;
 elsif v_status='rejected' then
   if p_confirmation->'not_settled_checked' is distinct from 'true'::jsonb or length(trim(coalesce(p_note,'')))<8 then
     raise exception 'Confirm the transfer was not settled and record the cancellation reason';
   end if;
   select id into v_wallet_id from public.wallets where store_id=w.store_id for update;
   if v_wallet_id is null then raise exception 'Seller wallet missing; do not cancel until reconciled'; end if;
 end if;
 perform set_config('sella.withdrawal_action','review-v2',true);
 update public.withdrawals set status=v_status,
   note=coalesce(nullif(trim(p_note),''),note),
   processed_at=case when v_status in ('paid','rejected') then now() else processed_at end,
   settlement_checked_by=case when v_status='paid' then auth.uid() else settlement_checked_by end,
   settlement_checked_at=case when v_status='paid' then now() else settlement_checked_at end,
   settlement_channel=case when v_status='paid' then v_channel else settlement_channel end,
   settlement_reference=case when v_status='paid' then v_reference else settlement_reference end,
   settlement_paid_at=case when v_status='paid' then v_paid_at else settlement_paid_at end,
   cancellation_checked_by=case when v_status='rejected' then auth.uid() else cancellation_checked_by end,
   cancellation_checked_at=case when v_status='rejected' then now() else cancellation_checked_at end
 where id=w.id;
 if v_status='rejected' then
   update public.wallets set available=coalesce(available,0)+w.amount where id=v_wallet_id;
   insert into public.wallet_transactions(wallet_id,kind,amount,note,status)
   values(v_wallet_id,'credit',w.amount,'Withdrawal '||w.id::text||' cancelled after confirming no settlement','completed');
 end if;
 insert into public.admin_audit_logs(admin_user_id,action,entity,entity_id,details)
 values(auth.uid(),'withdrawal_review','withdrawal',w.id,jsonb_build_object('from',w.status,'to',v_status,'note',p_note,'confirmation_method',case when v_status='paid' then 'manual_bank_channel_check' else 'manual_review' end,'channel',v_channel,'reference',v_reference,'confirmed_amount',v_amount,'paid_at',v_paid_at,'not_settled_checked',p_confirmation->'not_settled_checked','refunded',v_status='rejected'));
 perform set_config('sella.withdrawal_action','',true);
 return jsonb_build_object('success',true,'changed',true,'id',w.id,'status',v_status,'owner_id',v_owner,'amount',w.amount,'refunded',v_status='rejected');
end $$;
revoke all on function public.admin_review_withdrawal(uuid,text,jsonb,text) from public,anon;
grant execute on function public.admin_review_withdrawal(uuid,text,jsonb,text) to authenticated;

-- Legacy clients may still start a review; completion/cancellation need the new explicit checks.
create or replace function public.admin_process_withdrawal(p_withdrawal_id uuid,p_status text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
begin
 if p_status is distinct from 'processing' then raise exception 'Refresh Admin and use the banking confirmation or cancellation review form'; end if;
 return public.admin_review_withdrawal(p_withdrawal_id,p_status,'{}'::jsonb,p_note);
end $$;
revoke all on function public.admin_process_withdrawal(uuid,text,text) from public,anon;
grant execute on function public.admin_process_withdrawal(uuid,text,text) to authenticated;

-- Remove discovery enumeration but preserve single-store badge expiry checks.
create or replace function public.get_public_verified_store_ids()
returns table(store_id uuid) language sql stable security definer set search_path=public,pg_temp as $$
 select id from public.stores where false;
$$;
notify pgrst,'reload schema';

create or replace function public.audit_withdrawal_receipt_change()
returns trigger language plpgsql security definer set search_path=public,auth,pg_temp as $$
begin
 if (new.receipt_path,new.receipt_name) is distinct from (old.receipt_path,old.receipt_name) then
   insert into public.admin_audit_logs(admin_user_id,action,entity,entity_id,details)
   values(auth.uid(),'withdrawal_receipt_attached','withdrawal',new.id,jsonb_build_object('receipt_path',new.receipt_path,'receipt_name',new.receipt_name,'settlement_confirmed',false));
 end if;
 return new;
end $$;
drop trigger if exists withdrawal_receipt_audit on public.withdrawals;
create trigger withdrawal_receipt_audit after update on public.withdrawals for each row execute function public.audit_withdrawal_receipt_change();
