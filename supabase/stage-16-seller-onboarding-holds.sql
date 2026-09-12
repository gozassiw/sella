-- Sella Stage 16: complete seller onboarding, verification gates, and account holds.

alter table public.stores
  add column if not exists onboarding_submitted_at timestamptz,
  add column if not exists verification_notes text;

alter table public.store_bank_accounts
  add column if not exists verified boolean not null default false;

create table if not exists public.account_holds (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('buyer','seller','both')),
  reason text not null,
  status text not null default 'held' check (status in ('held','released')),
  held_at timestamptz not null default now(),
  released_at timestamptz,
  held_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists account_holds_status_idx on public.account_holds(status, held_at desc);
alter table public.account_holds enable row level security;
drop policy if exists "account_holds: owner read" on public.account_holds;
create policy "account_holds: owner read" on public.account_holds for select using (user_id = auth.uid());

create or replace function public.is_account_held(p_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public, auth
as $$
  select exists (
    select 1 from public.account_holds
    where user_id = coalesce(p_user_id, auth.uid()) and status = 'held'
  );
$$;
grant execute on function public.is_account_held(uuid) to anon, authenticated;

create or replace function public.store_can_operate(p_store_id uuid)
returns boolean
language sql stable security definer set search_path = public, auth
as $$
  select exists (
    select 1 from public.stores s
    where s.id = p_store_id
      and s.approval_status = 'approved'
      and s.is_published = true
      and not public.is_account_held(s.owner_id)
  );
$$;
grant execute on function public.store_can_operate(uuid) to anon, authenticated;

-- Pending stores can be viewed only to show the verification-in-progress page.
drop policy if exists "stores: public read published" on public.stores;
create policy "stores: public read published" on public.stores
  for select using ((approval_status = 'pending') or (is_published and approval_status = 'approved') or owner_id = auth.uid());

-- Product writes are unavailable until the seller is approved and not held.
drop policy if exists "products: owner manage" on public.products;
create policy "products: owner manage" on public.products
  for all using (public.store_can_operate(store_id)) with check (public.store_can_operate(store_id));

-- Allow a seller to edit onboarding details while pending, but not to self-approve or publish.
create or replace function public.enforce_store_approval()
returns trigger
language plpgsql security definer set search_path = public, auth
as $$
begin
  if auth.role() = 'authenticated' and not public.is_platform_admin() then
    if tg_op = 'INSERT' then
      new.approval_status := 'pending';
      new.is_published := false;
      new.approved_at := null;
      new.rejected_at := null;
      new.rejection_reason := null;
      new.trial_starts_at := null;
    elsif tg_op = 'UPDATE' then
      if old.approval_status = 'rejected' and new.approval_status = 'pending' then
        new.approval_status := 'pending';
        new.is_published := false;
        new.approved_at := null;
        new.rejected_at := null;
        new.rejection_reason := null;
        new.trial_starts_at := null;
      elsif new.approval_status is distinct from old.approval_status then
        new.approval_status := old.approval_status;
        new.approved_at := old.approved_at;
        new.rejected_at := old.rejected_at;
        new.rejection_reason := old.rejection_reason;
        new.trial_starts_at := old.trial_starts_at;
        new.trial_ends_at := old.trial_ends_at;
      end if;
    end if;
  end if;
  if new.approval_status <> 'approved' then new.is_published := false; end if;
  return new;
end;
$$;
drop trigger if exists stores_approval_guard on public.stores;
create trigger stores_approval_guard before insert or update on public.stores for each row execute function public.enforce_store_approval();

-- Admin approval requires the seller to have submitted the mandatory identity,
-- address, and payout details before the store can go live.
create or replace function public.admin_apply_action(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_store_id uuid;
  v_withdrawal_id uuid;
  v_report_id uuid;
  v_key text;
  v_status text;
  v_approved boolean;
  v_now timestamptz := now();
  v_store public.stores%rowtype;
begin
  if not public.is_platform_admin() then raise exception 'Admin access required'; end if;

  if p_action = 'store_trust' then
    update public.stores set trusted = coalesce((p_payload->>'trusted')::boolean, false)
    where id = (p_payload->>'storeId')::uuid;
  elsif p_action = 'withdrawal_status' then
    v_status := p_payload->>'status';
    update public.withdrawals set status = v_status, note = nullif(p_payload->>'note', ''), processed_at = case when v_status = 'sent' then v_now else null end
    where id = (p_payload->>'withdrawalId')::uuid;
  elsif p_action = 'report_status' then
    update public.reports set status = coalesce(nullif(p_payload->>'status', ''), 'resolved')
    where id = (p_payload->>'reportId')::uuid;
  elsif p_action = 'setting' then
    v_key := p_payload->>'key';
    insert into public.app_settings(key, value, updated_at) values (v_key, coalesce(p_payload->'value', '{}'::jsonb), v_now)
    on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
  elsif p_action = 'verification' then
    v_approved := coalesce((p_payload->>'approved')::boolean, false);
    update public.stores set verification_approved = v_approved, nin_status = case when v_approved then 'verified' else 'pending' end, verification_notes = nullif(p_payload->>'notes', '')
    where id = (p_payload->>'storeId')::uuid;
  elsif p_action = 'store_approval' then
    v_approved := (p_payload->>'approvalStatus') = 'approved';
    v_store_id := (p_payload->>'storeId')::uuid;
    select * into v_store from public.stores where id = v_store_id;
    if v_approved and (nullif(trim(v_store.legal_name), '') is null or nullif(trim(v_store.nin), '') is null or nullif(trim(v_store.address), '') is null or not exists (select 1 from public.store_bank_accounts where store_id = v_store_id and nullif(trim(account_number), '') is not null)) then
      raise exception 'Complete the seller legal name, NIN, store or pickup address, and payout account before approval.';
    end if;
    update public.stores set
      approval_status = case when v_approved then 'approved' else 'rejected' end,
      is_published = v_approved,
      approved_at = case when v_approved then v_now else null end,
      rejected_at = case when v_approved then null else v_now end,
      rejection_reason = case when v_approved then null else coalesce(nullif(p_payload->>'reason', ''), 'Please update your store details and resubmit for review.') end,
      trial_starts_at = case when v_approved then v_now else null end,
      trial_ends_at = case when v_approved then v_now + interval '10 days' else trial_ends_at end,
      verification_approved = v_approved,
      nin_status = case when v_approved then 'verified' else 'pending' end,
      verification_notes = nullif(p_payload->>'notes', '')
    where id = v_store_id;
  elsif p_action = 'account_hold' then
    if coalesce((p_payload->>'held')::boolean, true) then
      insert into public.account_holds(user_id, role, reason, status, held_at, released_at, held_by, updated_at)
      values ((p_payload->>'userId')::uuid, coalesce(nullif(p_payload->>'role', ''), 'both'), coalesce(nullif(trim(p_payload->>'reason'), ''), 'Account placed on hold by Sella Team.'), 'held', v_now, null, auth.uid(), v_now)
      on conflict (user_id) do update set role = excluded.role, reason = excluded.reason, status = 'held', held_at = v_now, released_at = null, held_by = auth.uid(), updated_at = v_now;
    else
      update public.account_holds set status = 'released', released_at = v_now, updated_at = v_now where user_id = (p_payload->>'userId')::uuid;
    end if;
  else
    raise exception 'Unknown admin action';
  end if;

  insert into public.admin_audit_logs(admin_user_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, nullif(p_payload->>'entity', ''), coalesce(nullif(p_payload->>'storeId', ''), nullif(p_payload->>'withdrawalId', ''), nullif(p_payload->>'reportId', ''), nullif(p_payload->>'userId', ''))::uuid, p_payload - 'publicKey' - 'secretKey' - 'encryptionKey');

  return jsonb_build_object('success', true);
end;
$$;
grant execute on function public.admin_apply_action(text, jsonb) to authenticated;

-- Include holds in the Admin control-room snapshot.
create or replace function public.admin_dashboard_snapshot()
returns jsonb
language plpgsql stable security definer set search_path = public, auth
as $$
begin
  if not public.is_platform_admin() then raise exception 'Admin access required'; end if;
  return jsonb_build_object(
    'stores', coalesce((select jsonb_agg((to_jsonb(s) - 'owner_id') order by s.created_at desc) from public.stores s), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(to_jsonb(o) || jsonb_build_object('stores', jsonb_build_object('name', s.name)) order by o.created_at desc) from public.orders o left join public.stores s on s.id = o.store_id), '[]'::jsonb),
    'subscriptions', coalesce((select jsonb_agg(to_jsonb(x) || jsonb_build_object('stores', jsonb_build_object('name', s.name)) order by x.started_at desc) from public.subscriptions x left join public.stores s on s.id = x.store_id), '[]'::jsonb),
    'withdrawals', coalesce((select jsonb_agg(to_jsonb(w) || jsonb_build_object('stores', jsonb_build_object('name', s.name)) order by w.created_at desc) from public.withdrawals w left join public.stores s on s.id = w.store_id), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('stores', jsonb_build_object('name', s.name), 'orders', case when o.id is null then null else jsonb_build_object('order_number', o.order_number, 'total', o.total) end, 'products', case when p.id is null then null else jsonb_build_object('name', p.name) end) order by r.created_at desc) from public.reports r left join public.stores s on s.id = r.store_id left join public.orders o on o.id = r.order_id left join public.products p on p.id = r.product_id), '[]'::jsonb),
    'settings', coalesce((select jsonb_agg(to_jsonb(a)) from public.app_settings a), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.received_at desc) from public.payment_webhook_events e limit 30), '[]'::jsonb),
    'audit_logs', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from public.admin_audit_logs l limit 30), '[]'::jsonb),
    'wallets', coalesce((select jsonb_agg(to_jsonb(w) || jsonb_build_object('stores', jsonb_build_object('name', s.name)) order by w.available desc) from public.wallets w left join public.stores s on s.id = w.store_id), '[]'::jsonb),
    'account_holds', coalesce((select jsonb_agg(to_jsonb(h) || jsonb_build_object('email', u.email) order by h.updated_at desc) from public.account_holds h left join auth.users u on u.id = h.user_id), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.admin_dashboard_snapshot() to authenticated;

-- Ensure public store reads can show the verification-in-progress state without exposing products.
create index if not exists stores_onboarding_idx on public.stores(approval_status, onboarding_submitted_at desc);
create index if not exists account_holds_user_status_idx on public.account_holds(user_id, status);

-- Existing stores remain available; new seller submissions are pending by default.
update public.stores set onboarding_submitted_at = coalesce(onboarding_submitted_at, created_at) where onboarding_submitted_at is null;

notify pgrst, 'reload schema';
