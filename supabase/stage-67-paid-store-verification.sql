-- Sella Stage 67: paid store verification add-on and scoped discovery eligibility.

alter table public.stores
  add column if not exists paid_verification_approved boolean not null default false,
  add column if not exists paid_verification_approved_at timestamptz;

create table if not exists public.store_verification_purchases (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_with text not null default 'transfer' check (paid_with in ('wallet','transfer')),
  status text not null default 'pending' check (status in ('pending','paid','approved','rejected','expired')),
  payment_account_number text,
  payment_account_name text,
  payment_bank_name text,
  payment_account_expires_at timestamptz,
  payment_reference text,
  paid_at timestamptz,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
create index if not exists store_verification_purchases_store_idx on public.store_verification_purchases(store_id, created_at desc);
create index if not exists store_verification_purchases_reference_idx on public.store_verification_purchases(payment_reference);
alter table public.store_verification_purchases enable row level security;
drop policy if exists "verification purchases: owner read" on public.store_verification_purchases;
create policy "verification purchases: owner read" on public.store_verification_purchases for select using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
revoke all on public.store_verification_purchases from anon, authenticated;
grant select on public.store_verification_purchases to authenticated;

create or replace function public.create_store_verification_purchase(p_store_id uuid, p_amount numeric)
returns public.store_verification_purchases language plpgsql security definer set search_path = public, auth as $$
declare v_price numeric(12,2); v_purchase public.store_verification_purchases;
begin
  if auth.uid() is null then raise exception 'Not authorised'; end if;
  if not exists (select 1 from public.stores where id = p_store_id and owner_id = auth.uid() and approval_status = 'approved') then raise exception 'Your store must be approved before paid verification'; end if;
  select coalesce((value->>'amount')::numeric, 0) into v_price from public.app_settings where key = 'paid_verification_fee';
  if v_price <= 0 then raise exception 'Sella has not set the paid verification price yet'; end if;
  if round(coalesce(p_amount, 0), 2) <> round(v_price, 2) then raise exception 'The verification price has changed. Refresh and try again.'; end if;
  update public.store_verification_purchases set status = 'expired' where store_id = p_store_id and status = 'pending' and payment_account_expires_at is not null and payment_account_expires_at < now();
  insert into public.store_verification_purchases(store_id, amount, paid_with, status) values (p_store_id, v_price, 'transfer', 'pending') returning * into v_purchase;
  return v_purchase;
end; $$;
revoke all on function public.create_store_verification_purchase(uuid, numeric) from public, anon;
grant execute on function public.create_store_verification_purchase(uuid, numeric) to authenticated;

create or replace function public.set_store_verification_payment_account(p_purchase_id uuid, p_account_number text, p_account_name text default null, p_bank_name text default null, p_payment_reference text default null)
returns public.store_verification_purchases language plpgsql security definer set search_path = public, auth as $$
declare v_purchase public.store_verification_purchases;
begin
  if auth.uid() is null then raise exception 'Not authorised'; end if;
  update public.store_verification_purchases v set payment_account_number=p_account_number, payment_account_name=p_account_name, payment_bank_name=p_bank_name, payment_reference=coalesce(p_payment_reference,v.payment_reference), payment_account_expires_at=now()+interval '30 minutes' from public.stores s where v.id=p_purchase_id and s.id=v.store_id and s.owner_id=auth.uid() returning v.* into v_purchase;
  if not found then raise exception 'Verification purchase not found'; end if;
  return v_purchase;
end; $$;
revoke all on function public.set_store_verification_payment_account(uuid,text,text,text,text) from public, anon;
grant execute on function public.set_store_verification_payment_account(uuid,text,text,text,text) to authenticated;

create or replace function public.pay_store_verification_from_wallet(p_store_id uuid, p_amount numeric)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_price numeric(12,2); v_store public.stores; v_wallet public.wallets; v_purchase public.store_verification_purchases;
begin
  if auth.uid() is null then raise exception 'Not authorised'; end if;
  select * into v_store from public.stores where id=p_store_id and owner_id=auth.uid() and approval_status='approved' for update;
  if not found then raise exception 'Approved store not found'; end if;
  select coalesce((value->>'amount')::numeric,0) into v_price from public.app_settings where key='paid_verification_fee';
  if v_price<=0 then raise exception 'Sella has not set the paid verification price yet'; end if;
  if round(coalesce(p_amount,0),2)<>round(v_price,2) then raise exception 'The verification price has changed. Refresh and try again.'; end if;
  select * into v_wallet from public.wallets where store_id=p_store_id for update;
  if not found or coalesce(v_wallet.available,0)<v_price then raise exception 'Insufficient Sella balance'; end if;
  insert into public.store_verification_purchases(store_id,amount,paid_with,status,paid_at,payment_reference) values(p_store_id,v_price,'wallet','paid',now(),'wallet:'||gen_random_uuid()::text) returning * into v_purchase;
  update public.wallets set available=available-v_price where id=v_wallet.id;
  insert into public.wallet_transactions(wallet_id,kind,amount,note) values(v_wallet.id,'plan_payment',-v_price,'Paid Sella blue checkmark verification review');
  insert into public.notifications(user_id,type,title,body,link) values(auth.uid(),'verification','Verification payment received','Your blue checkmark review payment was received. Sella Team will review your store.','/dashboard/verification-badge');
  perform public.notify_platform_admins('verification','Paid verification review requested',v_store.name||' paid for a blue checkmark review.','/admin?section=badge_reviews');
  return jsonb_build_object('success',true,'paid',true,'purchase_id',v_purchase.id,'status','paid','amount',v_price);
end; $$;
revoke all on function public.pay_store_verification_from_wallet(uuid,numeric) from public, anon;
grant execute on function public.pay_store_verification_from_wallet(uuid,numeric) to authenticated;

create or replace function public.process_store_verification_webhook(p_event_key text,p_payload jsonb,p_successful boolean,p_account_number text default null,p_account_reference text default null,p_amount numeric default 0,p_payment_reference text default null,p_order_reference text default null)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_purchase public.store_verification_purchases; v_store public.stores; v_event_id uuid; v_account_number text; v_account_reference text; v_payload_data jsonb:=coalesce(p_payload->'data',p_payload->'Data',p_payload);
begin
  v_account_number:=coalesce(p_account_number,nullif(v_payload_data#>>'{orderPayments,0,orderPaymentInstrument}',''),nullif(v_payload_data->>'accountNumber',''),nullif(v_payload_data->>'AccountNumber',''));
  v_account_reference:=coalesce(p_account_reference,nullif(v_payload_data->>'accountReference',''),nullif(v_payload_data->>'AccountReference',''));
  select * into v_purchase from public.store_verification_purchases where status='pending' and ((nullif(p_order_reference,'') is not null and id::text=p_order_reference) or (nullif(p_payment_reference,'') is not null and payment_reference=p_payment_reference) or (nullif(v_account_reference,'') is not null and payment_reference=v_account_reference) or (nullif(v_account_number,'') is not null and payment_account_number=v_account_number)) order by created_at desc limit 1;
  if v_purchase.id is null then return jsonb_build_object('handled',false); end if;
  insert into public.payment_webhook_events(provider,event_key,payload) values('transactpay',p_event_key,coalesce(p_payload,'{}')) on conflict(event_key) do nothing returning id into v_event_id;
  if v_event_id is null then return jsonb_build_object('handled',true,'duplicate',true); end if;
  if v_purchase.payment_account_expires_at is not null and now()>v_purchase.payment_account_expires_at then update public.store_verification_purchases set status='expired' where id=v_purchase.id and status='pending'; return jsonb_build_object('handled',true,'ignored',true,'reason','payment_account_expired'); end if;
  if not coalesce(p_successful,false) or coalesce(p_amount,0)<v_purchase.amount then return jsonb_build_object('handled',true,'ignored',true,'reason','payment_not_successful_or_insufficient'); end if;
  update public.store_verification_purchases set status='paid',paid_at=now(),payment_reference=coalesce(p_payment_reference,payment_reference) where id=v_purchase.id and status='pending';
  select * into v_store from public.stores where id=v_purchase.store_id;
  insert into public.notifications(user_id,type,title,body,link) values(v_store.owner_id,'verification','Verification payment received','Your blue checkmark review payment was received. Sella Team will review your store.','/dashboard/verification-badge');
  perform public.notify_platform_admins('verification','Paid verification review requested',v_store.name||' paid for a blue checkmark review.','/admin?section=badge_reviews');
  return jsonb_build_object('handled',true,'paid',true,'purchase_id',v_purchase.id,'user_id',v_store.owner_id,'store_id',v_purchase.store_id);
end; $$;
revoke all on function public.process_store_verification_webhook(text,jsonb,boolean,text,text,numeric,text,text) from public,anon,authenticated;
grant execute on function public.process_store_verification_webhook(text,jsonb,boolean,text,text,numeric,text,text) to service_role;

create or replace function public.admin_review_paid_verification(p_purchase_id uuid,p_approved boolean,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_purchase public.store_verification_purchases; v_store public.stores; v_user_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'Admin access required'; end if;
  select * into v_purchase from public.store_verification_purchases where id=p_purchase_id for update;
  if v_purchase.id is null then raise exception 'Verification purchase not found'; end if;
  if v_purchase.status not in ('paid','approved','rejected') then raise exception 'Payment must be confirmed before review'; end if;
  update public.store_verification_purchases set status=case when p_approved then 'approved' else 'rejected' end,reviewed_at=now(),review_note=nullif(p_note,'') where id=v_purchase.id;
  update public.stores set paid_verification_approved=p_approved,paid_verification_approved_at=case when p_approved then now() else null end where id=v_purchase.store_id returning * into v_store;
  v_user_id:=v_store.owner_id;
  insert into public.notifications(user_id,type,title,body,link) values(v_user_id,'verification',case when p_approved then 'Blue checkmark approved' else 'Blue checkmark review update' end,case when p_approved then 'Your Sella blue checkmark is now active and your store can appear in buyer discovery.' else coalesce(nullif(p_note,''),'Your blue checkmark review was not approved.') end,'/dashboard/verification-badge');
  return jsonb_build_object('success',true,'approved',p_approved,'store_id',v_store.id,'user_id',v_user_id);
end; $$;
revoke all on function public.admin_review_paid_verification(uuid,boolean,text) from public,anon;
grant execute on function public.admin_review_paid_verification(uuid,boolean,text) to authenticated;

create or replace function public.admin_paid_verification_snapshot()
returns jsonb language sql stable security definer set search_path=public,auth as $$
  select coalesce(jsonb_agg(to_jsonb(v)||jsonb_build_object('stores',jsonb_build_object('name',s.name,'slug',s.slug)) order by v.created_at desc),'[]'::jsonb)
  from public.store_verification_purchases v left join public.stores s on s.id=v.store_id
  where public.is_platform_admin();
$$;
grant execute on function public.admin_paid_verification_snapshot() to authenticated;

notify pgrst, 'reload schema';
