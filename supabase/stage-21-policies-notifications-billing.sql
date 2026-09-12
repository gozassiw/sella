-- Sella Stage 21: policy consent, notifications, ten-day trial, and plan-payment metadata.

create table if not exists public.account_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now(),
  source text not null default 'signup',
  updated_at timestamptz not null default now()
);
alter table public.account_consents enable row level security;
drop policy if exists "account_consents: owner manage" on public.account_consents;
create policy "account_consents: owner manage" on public.account_consents for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'system',
  title text not null,
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "notifications: owner read" on public.notifications;
create policy "notifications: owner read" on public.notifications for select using (user_id = auth.uid());
drop policy if exists "notifications: owner update" on public.notifications;
create policy "notifications: owner update" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subscriptions: owner manage" on public.push_subscriptions;
create policy "push_subscriptions: owner manage" on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.create_notification(p_user_id uuid, p_type text, p_title text, p_body text, p_link text default null)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare v_id uuid;
begin
  if p_user_id is distinct from auth.uid() and not public.is_platform_admin() then raise exception 'Notification access denied'; end if;
  insert into public.notifications(user_id, type, title, body, link) values (p_user_id, coalesce(nullif(p_type, ''), 'system'), p_title, p_body, p_link) returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.create_notification(uuid, text, text, text, text) to authenticated;

create or replace function public.notify_platform_admins(p_type text, p_title text, p_body text, p_link text default '/admin')
returns integer language plpgsql security definer set search_path = public, auth as $$
declare v_admin record; v_count integer := 0;
begin
  for v_admin in select u.id from auth.users u join public.platform_admins a on lower(a.email) = lower(u.email) loop
    insert into public.notifications(user_id, type, title, body, link) values (v_admin.id, coalesce(nullif(p_type, ''), 'system'), p_title, p_body, p_link);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
grant execute on function public.notify_platform_admins(text, text, text, text) to authenticated;

alter table public.subscriptions
  add column if not exists payment_account_number text,
  add column if not exists payment_account_name text,
  add column if not exists payment_bank_name text,
  add column if not exists payment_reference text,
  add column if not exists paid_at timestamptz;
create index if not exists subscriptions_payment_reference_idx on public.subscriptions(payment_reference);

alter table public.stores alter column trial_ends_at set default (now() + interval '10 days');
update public.stores set trial_ends_at = trial_starts_at + interval '10 days' where plan = 'trial' and trial_starts_at is not null and trial_ends_at is not null and trial_ends_at > trial_starts_at + interval '10 days';

-- Existing admin approval function, with a ten-day trial and notification events.
create or replace function public.admin_apply_action(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_store_id uuid; v_status text; v_approved boolean; v_now timestamptz := now(); v_store public.stores%rowtype; v_notification_id uuid; v_user_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'Admin access required'; end if;
  if p_action = 'store_trust' then
    update public.stores set trusted = coalesce((p_payload->>'trusted')::boolean, false) where id = (p_payload->>'storeId')::uuid;
  elsif p_action = 'withdrawal_status' then
    v_status := p_payload->>'status'; update public.withdrawals set status = v_status, note = nullif(p_payload->>'note', ''), processed_at = case when v_status = 'sent' then v_now else null end where id = (p_payload->>'withdrawalId')::uuid;
  elsif p_action = 'report_status' then
    update public.reports set status = coalesce(nullif(p_payload->>'status', ''), 'resolved') where id = (p_payload->>'reportId')::uuid;
  elsif p_action = 'setting' then
    insert into public.app_settings(key, value, updated_at) values (p_payload->>'key', coalesce(p_payload->'value', '{}'::jsonb), v_now) on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
  elsif p_action = 'verification' then
    v_approved := coalesce((p_payload->>'approved')::boolean, false); update public.stores set verification_approved = v_approved, nin_status = case when v_approved then 'verified' else 'pending' end, verification_notes = nullif(p_payload->>'notes', '') where id = (p_payload->>'storeId')::uuid;
  elsif p_action = 'store_approval' then
    v_approved := (p_payload->>'approvalStatus') = 'approved'; v_store_id := (p_payload->>'storeId')::uuid; select * into v_store from public.stores where id = v_store_id;
    if v_approved and (nullif(trim(v_store.legal_name), '') is null or nullif(trim(v_store.nin), '') is null or nullif(trim(v_store.address), '') is null or not exists (select 1 from public.store_bank_accounts where store_id = v_store_id and nullif(trim(account_number), '') is not null)) then raise exception 'Complete the seller legal name, NIN, store or pickup address, and payout account before approval.'; end if;
    update public.stores set approval_status = case when v_approved then 'approved' else 'rejected' end, is_published = v_approved, approved_at = case when v_approved then v_now else null end, rejected_at = case when v_approved then null else v_now end, rejection_reason = case when v_approved then null else coalesce(nullif(p_payload->>'reason', ''), 'Please update your store details and resubmit for review.') end, trial_starts_at = case when v_approved then v_now else null end, trial_ends_at = case when v_approved then v_now + interval '10 days' else trial_ends_at end, verification_approved = v_approved, nin_status = case when v_approved then 'verified' else 'pending' end, verification_notes = nullif(p_payload->>'notes', '') where id = v_store_id;
    select owner_id into v_user_id from public.stores where id = v_store_id;
    insert into public.notifications(user_id, type, title, body, link) values (v_user_id, case when v_approved then 'approval' else 'verification' end, case when v_approved then 'Store approved' else 'Update requested for your store' end, case when v_approved then 'Your store is live. Your 10-day trial has started.' else coalesce(nullif(p_payload->>'reason', ''), 'Please update your seller details and resubmit for verification.') end, '/dashboard');
  elsif p_action = 'account_hold' then
    v_user_id := (p_payload->>'userId')::uuid;
    if coalesce((p_payload->>'held')::boolean, true) then
      insert into public.account_holds(user_id, role, reason, status, held_at, released_at, held_by, updated_at) values (v_user_id, coalesce(nullif(p_payload->>'role', ''), 'both'), coalesce(nullif(trim(p_payload->>'reason'), ''), 'Account placed on hold by Sella Team.'), 'held', v_now, null, auth.uid(), v_now) on conflict (user_id) do update set role = excluded.role, reason = excluded.reason, status = 'held', held_at = v_now, released_at = null, held_by = auth.uid(), updated_at = v_now;
      insert into public.notifications(user_id, type, title, body, link) values (v_user_id, 'account_hold', 'Account placed on hold', coalesce(nullif(trim(p_payload->>'reason'), ''), 'Sella Team has paused activity on this account.'), '/account/profile');
    else
      update public.account_holds set status = 'released', released_at = v_now, updated_at = v_now where user_id = v_user_id;
      insert into public.notifications(user_id, type, title, body, link) values (v_user_id, 'account_hold', 'Account released', 'Your Sella account is active again.', '/account');
    end if;
  else raise exception 'Unknown admin action';
  end if;
  insert into public.admin_audit_logs(admin_user_id, action, entity, entity_id, details) values (auth.uid(), p_action, nullif(p_payload->>'entity', ''), coalesce(nullif(p_payload->>'storeId', ''), nullif(p_payload->>'withdrawalId', ''), nullif(p_payload->>'reportId', ''), nullif(p_payload->>'userId', ''))::uuid, p_payload - 'publicKey' - 'secretKey' - 'encryptionKey');
  return jsonb_build_object('success', true, 'user_id', v_user_id, 'store_id', v_store_id, 'approved', v_approved);
end;
$$;
grant execute on function public.admin_apply_action(text, jsonb) to authenticated;

notify pgrst, 'reload schema';
