-- Sella Stage 79: durable, full-order paid cancellation refunds.
-- Provider-funded seller refunds are intentionally not supported.  A seller
-- can retry once wallet funds are subsequently available.

alter table public.orders
  add column if not exists refund_status text not null default 'not_required'
    check (refund_status in ('not_required','pending_review','pending_funding','processing','refunded','failed')),
  add column if not exists refund_reference uuid,
  add column if not exists cancellation_reason text,
  add column if not exists refund_stock_restored boolean not null default false;

alter table public.orders alter column total type numeric(18,2);
alter table public.orders alter column commission type numeric(18,2);
alter table public.orders alter column net_to_seller type numeric(18,2);
alter table public.wallets alter column available type numeric(18,2);
alter table public.wallets alter column held type numeric(18,2);
alter table public.buyer_wallets alter column balance type numeric(18,2);
alter table public.wallet_transactions alter column amount type numeric(18,2);
alter table public.buyer_wallet_transactions alter column amount type numeric(18,2);

-- Direct order updates are prevented by the table privilege below. Do not
-- install a trigger here: payment webhooks and expiry/admin SECURITY DEFINER
-- functions legitimately update these columns.
drop trigger if exists order_financial_update_guard on public.orders;
drop function if exists public.guard_order_financial_update();
revoke update on public.orders from authenticated, anon;

create table if not exists public.refund_obligations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  seller_store_id uuid not null references public.stores(id) on delete restrict,
  buyer_id uuid references auth.users(id) on delete set null,
  original_amount numeric(18,2) not null check (original_amount >= 0),
  refund_amount numeric(18,2) not null check (refund_amount >= 0),
  original_commission numeric(18,2) not null default 0,
  commission_reversal numeric(18,2) not null default 0,
  seller_contribution numeric(18,2) not null default 0,
  available_seller_funds numeric(18,2) not null default 0,
  outstanding_seller_contribution numeric(18,2) not null default 0,
  status text not null default 'pending_funding'
    check (status in ('pending_review','pending_funding','processing','refunded','failed')),
  cancellation_reason text not null,
  original_payment_reference text,
  original_payment_method text,
  source_transaction_context jsonb not null default '{}'::jsonb,
  funding_capability text not null default 'wallet_retry'
    check (funding_capability in ('wallet_retry','unsupported_provider')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  refunded_at timestamptz,
  constraint refund_obligation_amounts check (seller_contribution + commission_reversal = refund_amount)
);
create unique index if not exists refund_obligations_reference_idx on public.refund_obligations(id);
create index if not exists refund_obligations_seller_idx on public.refund_obligations(seller_store_id, status, created_at desc);
alter table public.refund_obligations
  add column if not exists original_payment_reference text,
  add column if not exists original_payment_method text,
  add column if not exists source_transaction_context jsonb not null default '{}'::jsonb;

create table if not exists public.refund_accounting (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null references public.refund_obligations(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  entry_type text not null check (entry_type in ('seller_debit','commission_reversal','buyer_credit','funding')),
  amount numeric(18,2) not null check (amount >= 0),
  reference text not null unique,
  created_at timestamptz not null default now()
);
create unique index if not exists refund_accounting_once_idx on public.refund_accounting(refund_id, entry_type);
alter table public.wallet_transactions add column if not exists refund_id uuid references public.refund_obligations(id);
create unique index if not exists wallet_refund_ledger_once_idx
  on public.wallet_transactions(wallet_id, order_id, kind) where kind='refund';

alter table public.refund_obligations enable row level security;
alter table public.refund_accounting enable row level security;
create policy "refund obligations: seller or buyer read" on public.refund_obligations
  for select using (public.owns_store(seller_store_id) or buyer_id = auth.uid());
create policy "refund obligations: admins read" on public.refund_obligations
  for select using (public.is_platform_admin());
create policy "refund accounting: seller or buyer read" on public.refund_accounting
  for select using (exists (
    select 1 from public.refund_obligations r
    where r.id = refund_id and (public.owns_store(r.seller_store_id) or r.buyer_id = auth.uid())
  ));
create policy "refund accounting: admins read" on public.refund_accounting
  for select using (public.is_platform_admin());
grant select on public.refund_obligations, public.refund_accounting to authenticated, service_role;

create or replace function public.cancel_order_and_refund(p_order_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare
  o public.orders%rowtype; w public.wallets%rowtype; bw public.buyer_wallets%rowtype;
  r public.refund_obligations%rowtype; i record; seller_available numeric(18,2);
  seller_due numeric(18,2); gross numeric(18,2); commission numeric(18,2); buyer_exists boolean;
begin
  perform set_config('sella.order_action','refund-v1',true);
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'Cancellation reason is required'; end if;
  select x.* into o from public.orders x join public.stores s on s.id=x.store_id
    where x.id=p_order_id and s.owner_id=auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(o.store_id::text, 7901));
  if o.status in ('shipped','delivered','cancelled') then raise exception 'This order cannot be cancelled'; end if;
  if o.payment_status <> 'paid' then
    update public.orders set status='cancelled', cancellation_reason=p_reason,
      cancelled_at=now(), refund_status='not_required' where id=o.id;
    if not o.refund_stock_restored then
      for i in select product_id,quantity from public.order_items where order_id=o.id loop
        update public.products set stock=stock+i.quantity where id=i.product_id;
      end loop;
      update public.orders set refund_stock_restored=true where id=o.id;
    end if;
    return jsonb_build_object('success',true,'refund_status','not_required');
  end if;
  gross := round(coalesce(o.total,0),2);
  seller_due := round(coalesce(o.net_to_seller,0),2);
  if seller_due < 0 or seller_due > gross then raise exception 'Invalid seller proceeds on paid order'; end if;
  -- The buyer is owed gross. Any provider fee delta is retained in the
  -- immutable source context; the refund legs always balance to gross.
  commission := round(gross-seller_due,2);
  select * into w from public.wallets where store_id=o.store_id for update;
  seller_available := round(greatest(coalesce(w.available,0),0),2);
  select exists(select 1 from public.buyer_wallets where user_id=o.buyer_id) into buyer_exists;
  insert into public.refund_obligations(order_id,seller_store_id,buyer_id,original_amount,refund_amount,
    original_commission,commission_reversal,seller_contribution,available_seller_funds,
    outstanding_seller_contribution,status,cancellation_reason,original_payment_reference,
    original_payment_method,source_transaction_context)
  values(o.id,o.store_id,o.buyer_id,gross,gross,commission,commission,
    seller_due,least(greatest(seller_available,0),seller_due),
    seller_due,
    case when seller_available >= seller_due and buyer_exists then 'processing'
      else 'pending_funding' end,p_reason,
    o.payment_reference,o.payment_method,jsonb_build_object('order_id',o.id,'payment_status',o.payment_status,
      'recorded_commission',o.commission,'provider_fee_difference',round(coalesce(o.commission,0)-commission,2)))
  on conflict(order_id) do update set updated_at=now()
  returning * into r;
  if not o.refund_stock_restored then
    for i in select product_id,quantity from public.order_items where order_id=o.id loop
      update public.products set stock=stock+i.quantity where id=i.product_id;
    end loop;
    update public.orders set refund_stock_restored=true where id=o.id;
  end if;
  update public.orders set status='cancelled', cancellation_reason=p_reason, cancelled_at=now(),
    refund_status=r.status, refund_reference=r.id where id=o.id;
  if r.status='processing' then
    begin
    select * into bw from public.buyer_wallets where user_id=o.buyer_id for update;
    if not found then raise exception 'Buyer wallet not found; refund remains unprocessed'; end if;
    update public.wallets set available=available-seller_due where id=w.id and available>=seller_due;
    if not found then raise exception 'Seller balance changed; retry refund'; end if;
    insert into public.wallet_transactions(wallet_id,order_id,refund_id,kind,amount,note,status)
      values(w.id,o.id,r.id,'refund',-seller_due,'Refund seller debit for cancelled order #'||o.order_code,'completed')
      on conflict (wallet_id,order_id,kind) where kind='refund' do nothing;
    insert into public.refund_accounting(refund_id,order_id,entry_type,amount,reference)
      values(r.id,o.id,'seller_debit',seller_due,'refund-seller-'||r.id),
        (r.id,o.id,'commission_reversal',commission,'refund-commission-'||r.id)
      on conflict do nothing;
    update public.buyer_wallets set balance=balance+gross where id=bw.id;
    insert into public.buyer_wallet_transactions(buyer_wallet_id,order_id,amount,label)
      values(bw.id,o.id,gross,'Refund for cancelled order #'||o.order_code);
    insert into public.refund_accounting(refund_id,order_id,entry_type,amount,reference)
      values(r.id,o.id,'buyer_credit',gross,'refund-buyer-'||r.id) on conflict do nothing;
    update public.refund_obligations set status='refunded', refunded_at=now(), updated_at=now() where id=r.id;
    update public.orders set refund_status='refunded', payment_status='refunded' where id=o.id;
    exception when others then
      update public.refund_obligations set status='failed', updated_at=now() where id=r.id;
      update public.orders set refund_status='failed' where id=o.id;
    end;
  end if;
  select ro.* into r from public.refund_obligations ro where ro.id=r.id;
  return jsonb_build_object('success',true,'refund_id',r.id,'refund_reference',r.id,
    'refund_amount',gross,'status',r.status,
    'refund_status',r.status,
    'changed',true,'credited_now',r.status='refunded',
    'outstanding_seller_contribution',case when r.status='refunded' then 0 else seller_due end);
end $$;
revoke all on function public.cancel_order_and_refund(uuid,text) from public, anon;
grant execute on function public.cancel_order_and_refund(uuid,text) to authenticated;

-- Authenticated seller retry; no provider/payment callback is implied.
create or replace function public.retry_refund_from_wallet(p_refund_id uuid)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare r public.refund_obligations%rowtype; o public.orders%rowtype; w public.wallets%rowtype;
  bw public.buyer_wallets%rowtype;
begin
  perform set_config('sella.order_action','refund-v1',true);
  select * into r from public.refund_obligations where id=p_refund_id for update;
  select * into o from public.orders where id=r.order_id for update;
  if not public.owns_store(r.seller_store_id) and not public.is_platform_admin() then raise exception 'Seller access required'; end if;
  if r.status='refunded' then return jsonb_build_object('success',true,'refund_id',r.id,'refund_reference',r.id,'refund_amount',r.refund_amount,'status','refunded','changed',false,'credited_now',false); end if;
  select * into w from public.wallets where store_id=r.seller_store_id for update;
  if coalesce(w.available,0)<r.seller_contribution then raise exception 'Insufficient eligible wallet funds'; end if;
  select * into bw from public.buyer_wallets where user_id=r.buyer_id for update;
  if not found then raise exception 'Buyer wallet not found'; end if;
  update public.wallets set available=available-r.seller_contribution where id=w.id and available>=r.seller_contribution;
  if not found then raise exception 'Seller balance changed; retry'; end if;
  insert into public.wallet_transactions(wallet_id,order_id,refund_id,kind,amount,note,status)
    values(w.id,o.id,r.id,'refund',-r.seller_contribution,'Refund seller debit for cancelled order #'||o.order_code,'completed')
    on conflict (wallet_id,order_id,kind) where kind='refund' do nothing;
  insert into public.refund_accounting(refund_id,order_id,entry_type,amount,reference) values
    (r.id,o.id,'seller_debit',r.seller_contribution,'refund-seller-'||r.id),
    (r.id,o.id,'commission_reversal',r.commission_reversal,'refund-commission-'||r.id)
    on conflict do nothing;
  update public.buyer_wallets set balance=balance+r.refund_amount where id=bw.id;
  insert into public.buyer_wallet_transactions(buyer_wallet_id,order_id,amount,label)
    values(bw.id,o.id,r.refund_amount,'Refund for cancelled order #'||o.order_code);
  insert into public.refund_accounting(refund_id,order_id,entry_type,amount,reference)
    values(r.id,o.id,'buyer_credit',r.refund_amount,'refund-buyer-'||r.id) on conflict do nothing;
  update public.refund_obligations set status='refunded',refunded_at=now(),updated_at=now() where id=r.id;
  update public.orders set refund_status='refunded',payment_status='refunded' where id=o.id;
  return jsonb_build_object('success',true,'refund_id',r.id,'refund_reference',r.id,'refund_amount',r.refund_amount,'status','refunded','changed',true,'credited_now',true);
end $$;
revoke all on function public.retry_refund_from_wallet(uuid) from public, anon;
grant execute on function public.retry_refund_from_wallet(uuid) to authenticated;

-- A pending seller refund blocks completion of that seller's bank payout.
-- This guard runs inside admin_review_withdrawal's transaction and never
-- changes a payout already in a final paid/sent state.
create or replace function public.guard_withdrawal_refund_obligation()
returns trigger language plpgsql security definer set search_path=public,auth,pg_temp as $$
begin
  -- Serialize payout completion with cancellation on the same seller wallet.
  perform pg_advisory_xact_lock(hashtextextended(new.store_id::text, 7901));
  if new.status in ('paid','sent') and old.status not in ('paid','sent')
     and exists (select 1 from public.refund_obligations r
                 where r.seller_store_id=new.store_id and r.status <> 'refunded') then
    raise exception 'Unresolved refund obligation blocks payout completion';
  end if;
  return new;
end $$;
drop trigger if exists withdrawal_refund_obligation_guard on public.withdrawals;
create trigger withdrawal_refund_obligation_guard before update on public.withdrawals
for each row execute function public.guard_withdrawal_refund_obligation();

create table if not exists public.refund_admin_notes (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null references public.refund_obligations(id) on delete cascade,
  admin_id uuid not null references auth.users(id),
  action text not null check (action in ('note','review','retry')),
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.refund_admin_notes enable row level security;
create policy "refund admin notes: admins read" on public.refund_admin_notes
  for select using (public.is_platform_admin());
grant select on public.refund_admin_notes to authenticated, service_role;

create or replace function public.admin_refund_note(p_refund_id uuid, p_action text, p_body text)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_admin uuid := auth.uid();
begin
  if not public.is_platform_admin() then raise exception 'Admin access required'; end if;
  if p_action not in ('note','review','retry') or nullif(trim(p_body),'') is null then raise exception 'A valid audit action and note are required'; end if;
  insert into public.refund_admin_notes(refund_id,admin_id,action,body) values(p_refund_id,v_admin,p_action,p_body);
  return jsonb_build_object('success',true);
end $$;
grant execute on function public.admin_refund_note(uuid,text,text) to authenticated;
revoke all on function public.admin_refund_note(uuid,text,text) from public, anon;

create or replace function public.admin_retry_refund(p_refund_id uuid)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare result jsonb; err text; rid uuid := auth.uid();
begin
  if not public.is_platform_admin() then raise exception 'Admin access required'; end if;
  begin
    result := public.retry_refund_from_wallet(p_refund_id);
    insert into public.refund_admin_notes(refund_id,admin_id,action,body)
      values(p_refund_id,rid,'retry','Admin retry result: '||result::text);
    return result || jsonb_build_object('audit_recorded',true);
  exception when others then
    get stacked diagnostics err = message_text;
    insert into public.refund_admin_notes(refund_id,admin_id,action,body)
      values(p_refund_id,rid,'retry','Admin retry failed: '||err);
    return jsonb_build_object('success',false,'status','failed','changed',false,'credited_now',false,'error',err,'audit_recorded',true);
  end;
end $$;
revoke all on function public.admin_retry_refund(uuid) from public, anon;
grant execute on function public.admin_retry_refund(uuid) to authenticated;

-- Stage 79 replacement: preserve Stage 77 payout validation while serializing
-- payout completion with paid-order cancellation on the seller store lock.
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
 perform pg_advisory_xact_lock(hashtextextended(w.store_id::text,7901));
  -- Preserve idempotent replay semantics for final and in-review states.
  -- This must precede the unresolved-refund guard: a replay must not attempt
  -- to reopen or revalidate an already completed payout.
  if w.status=v_status then return jsonb_build_object('success',true,'changed',false,'id',w.id,'owner_id',v_owner); end if;
 if v_status in ('paid','sent') and exists (select 1 from public.refund_obligations r where r.seller_store_id=w.store_id and r.status <> 'refunded') then
   raise exception 'Unresolved refund obligation blocks payout completion';
 end if;
 if w.status in ('paid','sent','rejected') then raise exception 'Final withdrawals cannot be reopened or changed'; end if;
 if w.status not in ('pending','processing') then raise exception 'Invalid current withdrawal status'; end if;
 if length(coalesce(p_note,''))>2000 then raise exception 'Keep the audit note under 2000 characters'; end if;
 if v_status='processing' and w.status <> 'pending' then raise exception 'Only pending withdrawals can enter review'; end if;
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
   if p_confirmation->'not_settled_checked' is distinct from 'true'::jsonb or length(trim(coalesce(p_note,'')))<8 then raise exception 'Confirm the transfer was not settled and record the cancellation reason'; end if;
   select id into v_wallet_id from public.wallets where store_id=w.store_id for update;
   if v_wallet_id is null then raise exception 'Seller wallet missing; do not cancel until reconciled'; end if;
 end if;
 perform set_config('sella.withdrawal_action','review-v2',true);
 update public.withdrawals set status=v_status,note=coalesce(nullif(trim(p_note),''),note),
   processed_at=case when v_status in ('paid','rejected') then now() else processed_at end,
   settlement_checked_by=case when v_status='paid' then auth.uid() else settlement_checked_by end,
   settlement_checked_at=case when v_status='paid' then now() else settlement_checked_at end,
   settlement_channel=case when v_status='paid' then v_channel else settlement_channel end,
   settlement_reference=case when v_status='paid' then v_reference else settlement_reference end,
   settlement_paid_at=case when v_status='paid' then v_paid_at else settlement_paid_at end,
   cancellation_checked_by=case when v_status='rejected' then auth.uid() else cancellation_checked_by end,
   cancellation_checked_at=case when v_status='rejected' then now() else cancellation_checked_at end where id=w.id;
 if v_status='rejected' then
   update public.wallets set available=coalesce(available,0)+w.amount where id=v_wallet_id;
   insert into public.wallet_transactions(wallet_id,kind,amount,note,status) values(v_wallet_id,'credit',w.amount,'Withdrawal '||w.id::text||' cancelled after confirming no settlement','completed');
 end if;
 insert into public.admin_audit_logs(admin_user_id,action,entity,entity_id,details)
 values(auth.uid(),'withdrawal_review','withdrawal',w.id,jsonb_build_object('from',w.status,'to',v_status,'note',p_note,'confirmation_method',case when v_status='paid' then 'manual_bank_channel_check' else 'manual_review' end,'channel',v_channel,'reference',v_reference,'confirmed_amount',v_amount,'paid_at',v_paid_at,'not_settled_checked',p_confirmation->'not_settled_checked','refunded',v_status='rejected'));
 perform set_config('sella.withdrawal_action','',true);
 return jsonb_build_object('success',true,'changed',true,'id',w.id,'status',v_status,'owner_id',v_owner,'amount',w.amount,'refunded',v_status='rejected');
end $$;
revoke all on function public.admin_review_withdrawal(uuid,text,jsonb,text) from public,anon;
grant execute on function public.admin_review_withdrawal(uuid,text,jsonb,text) to authenticated;