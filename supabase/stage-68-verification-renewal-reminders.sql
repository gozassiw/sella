-- Sella Stage 68: six-month paid verification validity and combined renewal reminders.

insert into public.app_settings(key, value, updated_at)
values ('paid_verification_fee', '{"amount":28000}'::jsonb, now())
on conflict (key) do update
set value = jsonb_set(coalesce(public.app_settings.value, '{}'::jsonb), '{amount}', '28000'::jsonb, true), updated_at = excluded.updated_at;

alter table public.store_verification_purchases
  add column if not exists expires_at timestamptz;

update public.store_verification_purchases
set expires_at = coalesce(paid_at, created_at) + interval '6 months'
where expires_at is null
  and status in ('paid', 'approved')
  and coalesce(paid_at, created_at) is not null;

create or replace function public.store_has_active_paid_verification(p_store_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.store_verification_purchases
    where store_id = p_store_id and status = 'approved' and expires_at is not null and expires_at > now()
  );
$$;
revoke all on function public.store_has_active_paid_verification(uuid) from public;
grant execute on function public.store_has_active_paid_verification(uuid) to anon, authenticated;

create or replace function public.get_public_verified_store_ids()
returns table(store_id uuid) language sql stable security definer set search_path = public as $$
  select distinct v.store_id
  from public.store_verification_purchases v
  join public.stores s on s.id = v.store_id
  where v.status = 'approved'
    and v.expires_at is not null
    and v.expires_at > now()
    and s.approval_status = 'approved'
    and s.is_published = true;
$$;
revoke all on function public.get_public_verified_store_ids() from public;
grant execute on function public.get_public_verified_store_ids() to anon, authenticated;

create or replace function public.sync_store_verification_status(p_store_id uuid)
returns boolean language plpgsql security definer set search_path = public, auth as $$
declare v_active boolean; v_owner uuid;
begin
  select owner_id into v_owner from public.stores where id = p_store_id;
  if v_owner is null or auth.uid() is null or auth.uid() <> v_owner then raise exception 'Store access denied'; end if;
  v_active := public.store_has_active_paid_verification(p_store_id);
  update public.stores set paid_verification_approved = v_active, paid_verification_approved_at = case when v_active then coalesce(paid_verification_approved_at, now()) else null end where id = p_store_id;
  return v_active;
end; $$;
revoke all on function public.sync_store_verification_status(uuid) from public, anon;
grant execute on function public.sync_store_verification_status(uuid) to authenticated;

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
  insert into public.store_verification_purchases(store_id,amount,paid_with,status,paid_at,expires_at,payment_reference) values(p_store_id,v_price,'wallet','paid',now(),now()+interval '6 months','wallet:'||gen_random_uuid()::text) returning * into v_purchase;
  update public.wallets set available=available-v_price where id=v_wallet.id;
  insert into public.wallet_transactions(wallet_id,kind,amount,note) values(v_wallet.id,'plan_payment',-v_price,'Paid Sella six-month verification checkmark review');
  insert into public.notifications(user_id,type,title,body,link) values(auth.uid(),'verification','Verification payment received','Your six-month blue checkmark review payment was received. Sella Team will review your store.','/dashboard/verification-badge');
  perform public.notify_platform_admins('verification','Paid verification review requested',v_store.name||' paid for a six-month blue checkmark review.','/admin?section=badge_reviews');
  return jsonb_build_object('success',true,'paid',true,'purchase_id',v_purchase.id,'status','paid','amount',v_price,'expires_at',v_purchase.expires_at);
end; $$;

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
  update public.store_verification_purchases set status='paid',paid_at=now(),expires_at=now()+interval '6 months',payment_reference=coalesce(p_payment_reference,payment_reference) where id=v_purchase.id and status='pending';
  select * into v_store from public.stores where id=v_purchase.store_id;
  insert into public.notifications(user_id,type,title,body,link) values(v_store.owner_id,'verification','Verification payment received','Your six-month blue checkmark review payment was received. Sella Team will review your store.','/dashboard/verification-badge');
  perform public.notify_platform_admins('verification','Paid verification review requested',v_store.name||' paid for a six-month blue checkmark review.','/admin?section=badge_reviews');
  return jsonb_build_object('handled',true,'paid',true,'purchase_id',v_purchase.id,'user_id',v_store.owner_id,'store_id',v_purchase.store_id,'expires_at',now()+interval '6 months');
end; $$;

create or replace function public.admin_review_paid_verification(p_purchase_id uuid,p_approved boolean,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_purchase public.store_verification_purchases; v_store public.stores; v_user_id uuid; v_other_active boolean;
begin
  if not public.is_platform_admin() then raise exception 'Admin access required'; end if;
  select * into v_purchase from public.store_verification_purchases where id=p_purchase_id for update;
  if v_purchase.id is null then raise exception 'Verification purchase not found'; end if;
  if v_purchase.status not in ('paid','approved','rejected') then raise exception 'Payment must be confirmed before review'; end if;
  update public.store_verification_purchases set status=case when p_approved then 'approved' else 'rejected' end, reviewed_at=now(), review_note=nullif(p_note,'') where id=v_purchase.id;
  select * into v_store from public.stores where id=v_purchase.store_id;
  if p_approved then
    update public.stores set paid_verification_approved=true, paid_verification_approved_at=now() where id=v_purchase.store_id;
  else
    select exists(select 1 from public.store_verification_purchases where store_id=v_purchase.store_id and id<>v_purchase.id and status='approved' and expires_at>now()) into v_other_active;
    if not v_other_active then update public.stores set paid_verification_approved=false, paid_verification_approved_at=null where id=v_purchase.store_id; end if;
  end if;
  v_user_id:=v_store.owner_id;
  insert into public.notifications(user_id,type,title,body,link) values(v_user_id,'verification',case when p_approved then 'Blue checkmark approved' else 'Blue checkmark review update' end,case when p_approved then 'Your six-month Sella blue checkmark is now active and your store can appear in buyer discovery.' else coalesce(nullif(p_note,''),'Your blue checkmark review was not approved.') end,'/dashboard/verification-badge');
  return jsonb_build_object('success',true,'approved',p_approved,'store_id',v_store.id,'user_id',v_user_id,'expires_at',v_purchase.expires_at);
end; $$;

create or replace function public.create_combined_renewal_reminder(p_store_id uuid)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_owner uuid; v_plan_name text; v_plan_expiry timestamptz; v_verification_expiry timestamptz; v_nearest timestamptz; v_days integer; v_body text; v_created boolean:=false; v_plan_label text; v_verification_label text;
begin
  select owner_id into v_owner from public.stores where id=p_store_id;
  if v_owner is null or auth.uid() is null or auth.uid()<>v_owner then raise exception 'Store access denied'; end if;
  perform public.sync_store_verification_status(p_store_id);
  select case when plan='basic' then 'Basic' when plan='plus' then 'Plus' when plan='premium' then 'Premium' when plan='quarterly' then 'Basic' when plan='biannual' then 'Plus' when plan='yearly' then 'Premium' else plan end, expires_at into v_plan_name,v_plan_expiry from public.subscriptions where store_id=p_store_id and status in ('paid','active') and expires_at>now() order by expires_at asc limit 1;
  select expires_at into v_verification_expiry from public.store_verification_purchases where store_id=p_store_id and status='approved' and expires_at>now() order by expires_at asc limit 1;
  if v_plan_expiry is null and v_verification_expiry is null then return jsonb_build_object('show',false,'created',false); end if;
  v_nearest:=least(coalesce(v_plan_expiry,'infinity'::timestamptz),coalesce(v_verification_expiry,'infinity'::timestamptz));
  v_days:=greatest(0,ceil(extract(epoch from (v_nearest-now()))/86400)::integer);
  if v_days>14 then return jsonb_build_object('show',false,'created',false,'plan_expires_at',v_plan_expiry,'verification_expires_at',v_verification_expiry); end if;
  v_plan_label:=case when v_plan_expiry is null then null else v_plan_name||' plan renews '||to_char(v_plan_expiry at time zone 'Africa/Lagos','D Mon YYYY') end;
  v_verification_label:=case when v_verification_expiry is null then null else 'verification checkmark renews '||to_char(v_verification_expiry at time zone 'Africa/Lagos','D Mon YYYY') end;
  v_body:='Renewal reminder: '||coalesce(v_plan_label,'')||case when v_plan_label is not null and v_verification_label is not null then '; ' else '' end||coalesce(v_verification_label,'')||'. Manage both renewals from your seller dashboard.';
  if not exists(select 1 from public.notifications where user_id=v_owner and type='renewal' and created_at>=current_date) then insert into public.notifications(user_id,type,title,body,link) values(v_owner,'renewal','Your Sella renewals are coming up',v_body,'/dashboard'); v_created:=true; end if;
  return jsonb_build_object('show',true,'created',v_created,'days',v_days,'body',v_body,'plan_expires_at',v_plan_expiry,'verification_expires_at',v_verification_expiry);
end; $$;
revoke all on function public.create_combined_renewal_reminder(uuid) from public,anon;
grant execute on function public.create_combined_renewal_reminder(uuid) to authenticated;

notify pgrst, 'reload schema';
