-- Sella Stage 14: authenticated Admin access through security-definer RPCs.
-- This lets configured platform admins load and manage the Admin workspace
-- using their Supabase session, without requiring a Vercel service-role key.

create table if not exists public.platform_admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

insert into public.platform_admins (email)
values ('sellalimited@gmail.com')
on conflict (email) do nothing;

alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.platform_admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on public.platform_admins from anon, authenticated;
grant execute on function public.is_platform_admin() to authenticated;

create or replace function public.admin_dashboard_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Admin access required';
  end if;

  return jsonb_build_object(
    'stores', coalesce((select jsonb_agg((to_jsonb(s) - 'owner_id') order by s.created_at desc) from public.stores s), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(to_jsonb(o) || jsonb_build_object('stores', jsonb_build_object('name', s.name)) order by o.created_at desc) from public.orders o left join public.stores s on s.id = o.store_id), '[]'::jsonb),
    'subscriptions', coalesce((select jsonb_agg(to_jsonb(x) || jsonb_build_object('stores', jsonb_build_object('name', s.name)) order by x.started_at desc) from public.subscriptions x left join public.stores s on s.id = x.store_id), '[]'::jsonb),
    'withdrawals', coalesce((select jsonb_agg(to_jsonb(w) || jsonb_build_object('stores', jsonb_build_object('name', s.name)) order by w.created_at desc) from public.withdrawals w left join public.stores s on s.id = w.store_id), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('stores', jsonb_build_object('name', s.name), 'orders', case when o.id is null then null else jsonb_build_object('order_number', o.order_number, 'total', o.total) end, 'products', case when p.id is null then null else jsonb_build_object('name', p.name) end) order by r.created_at desc) from public.reports r left join public.stores s on s.id = r.store_id left join public.orders o on o.id = r.order_id left join public.products p on p.id = r.product_id), '[]'::jsonb),
    'settings', coalesce((select jsonb_agg(to_jsonb(a)) from public.app_settings a), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.received_at desc) from public.payment_webhook_events e limit 30), '[]'::jsonb),
    'audit_logs', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from public.admin_audit_logs l limit 30), '[]'::jsonb),
    'wallets', coalesce((select jsonb_agg(to_jsonb(w) || jsonb_build_object('stores', jsonb_build_object('name', s.name)) order by w.available desc) from public.wallets w left join public.stores s on s.id = w.store_id), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.admin_dashboard_snapshot() to authenticated;

create or replace function public.admin_apply_action(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_store_id uuid;
  v_withdrawal_id uuid;
  v_report_id uuid;
  v_key text;
  v_status text;
  v_approved boolean;
  v_now timestamptz := now();
begin
  if not public.is_platform_admin() then
    raise exception 'Admin access required';
  end if;

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
    update public.stores set verification_approved = v_approved, nin_status = case when v_approved then 'verified' else 'pending' end
    where id = (p_payload->>'storeId')::uuid;
  elsif p_action = 'store_approval' then
    v_approved := (p_payload->>'approvalStatus') = 'approved';
    v_store_id := (p_payload->>'storeId')::uuid;
    update public.stores set
      approval_status = case when v_approved then 'approved' else 'rejected' end,
      is_published = v_approved,
      approved_at = case when v_approved then v_now else null end,
      rejected_at = case when v_approved then null else v_now end,
      rejection_reason = case when v_approved then null else coalesce(nullif(p_payload->>'reason', ''), 'Please update your store details and resubmit for review.') end,
      trial_starts_at = case when v_approved then v_now else null end,
      trial_ends_at = case when v_approved then v_now + interval '10 days' else trial_ends_at end
    where id = v_store_id;
  else
    raise exception 'Unknown admin action';
  end if;

  insert into public.admin_audit_logs(admin_user_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, nullif(p_payload->>'entity', ''), coalesce(nullif(p_payload->>'storeId', ''), nullif(p_payload->>'withdrawalId', ''), nullif(p_payload->>'reportId', ''))::uuid, p_payload - 'publicKey' - 'secretKey' - 'encryptionKey');

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.admin_apply_action(text, jsonb) to authenticated;
