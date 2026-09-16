-- Sella Stage 72: launch waiting room, private waitlist, and public launch settings.
create table if not exists public.launch_waitlist (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  email text not null,
  normalized_email text not null unique,
  whatsapp text not null check (char_length(trim(whatsapp)) between 7 and 40),
  status text not null default 'waiting' check (status in ('waiting', 'contacted', 'unsubscribed')),
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists launch_waitlist_created_idx on public.launch_waitlist(created_at desc);
create index if not exists launch_waitlist_status_idx on public.launch_waitlist(status, created_at desc);
alter table public.launch_waitlist enable row level security;
revoke all on public.launch_waitlist from anon, authenticated;
alter table public.launch_waitlist owner to postgres;

insert into public.app_settings(key, value, updated_at)
values ('launch_mode', '{"enabled":true,"launch_at":null}'::jsonb, now())
on conflict (key) do nothing;

create or replace function public.create_launch_waitlist_signup(p_full_name text, p_email text, p_whatsapp text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := left(trim(coalesce(p_full_name, '')), 120);
  v_email text := lower(left(trim(coalesce(p_email, '')), 320));
  v_whatsapp text := left(trim(coalesce(p_whatsapp, '')), 40);
  v_id uuid;
  v_created boolean := false;
begin
  if char_length(v_name) < 2 then raise exception 'Enter your full name.'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Enter a valid email address.'; end if;
  if char_length(v_whatsapp) < 7 then raise exception 'Enter a valid WhatsApp number.'; end if;

  insert into public.launch_waitlist(full_name, email, normalized_email, whatsapp)
  values (v_name, v_email, v_email, v_whatsapp)
  on conflict (normalized_email) do nothing
  returning id into v_id;

  if v_id is not null then
    v_created := true;
  else
    select id into v_id from public.launch_waitlist where normalized_email = v_email limit 1;
  end if;

  return jsonb_build_object('id', v_id, 'created', v_created);
end;
$$;
revoke all on function public.create_launch_waitlist_signup(text, text, text) from public;
grant execute on function public.create_launch_waitlist_signup(text, text, text) to anon, authenticated;

create or replace function public.get_public_launch_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'enabled', coalesce((select (value->>'enabled')::boolean from public.app_settings where key = 'launch_mode' limit 1), false),
    'launch_at', (select nullif(value->>'launch_at', '') from public.app_settings where key = 'launch_mode' limit 1)
  );
$$;
revoke all on function public.get_public_launch_settings() from public;
grant execute on function public.get_public_launch_settings() to anon, authenticated;

create or replace function public.admin_dashboard_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_platform_admin() then raise exception 'Admin access required'; end if;
  return jsonb_build_object(
    'stores', coalesce((select jsonb_agg(
      (to_jsonb(s) - 'owner_id')
      || jsonb_build_object(
        'seller_email', (select u.email from auth.users u where u.id = s.owner_id),
        'payout_accounts', coalesce((select jsonb_agg(to_jsonb(b) - 'id' - 'store_id' order by b.updated_at desc) from public.store_bank_accounts b where b.store_id = s.id), '[]'::jsonb)
      )
      order by s.created_at desc
    ) from public.stores s), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(to_jsonb(o) || jsonb_build_object('stores', jsonb_build_object('name', s.name)) order by o.created_at desc) from public.orders o left join public.stores s on s.id = o.store_id), '[]'::jsonb),
    'subscriptions', coalesce((select jsonb_agg(to_jsonb(x) || jsonb_build_object('stores', jsonb_build_object('name', s.name)) order by x.started_at desc) from public.subscriptions x left join public.stores s on s.id = x.store_id), '[]'::jsonb),
    'withdrawals', coalesce((select jsonb_agg(to_jsonb(w) || jsonb_build_object('stores', jsonb_build_object('name', s.name)) order by w.created_at desc) from public.withdrawals w left join public.stores s on s.id = w.store_id), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('stores', jsonb_build_object('name', s.name), 'orders', case when o.id is null then null else jsonb_build_object('order_number', o.order_number, 'total', o.total) end, 'products', case when p.id is null then null else jsonb_build_object('name', p.name) end) order by r.created_at desc) from public.reports r left join public.stores s on s.id = r.store_id left join public.orders o on o.id = r.order_id left join public.products p on p.id = r.product_id), '[]'::jsonb),
    'settings', coalesce((select jsonb_agg(to_jsonb(a)) from public.app_settings a), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.received_at desc) from public.payment_webhook_events e limit 30), '[]'::jsonb),
    'audit_logs', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from public.admin_audit_logs l limit 30), '[]'::jsonb),
    'wallets', coalesce((select jsonb_agg(to_jsonb(w) || jsonb_build_object('stores', jsonb_build_object('name', s.name)) order by w.available desc) from public.wallets w left join public.stores s on s.id = w.store_id), '[]'::jsonb),
    'account_holds', coalesce((select jsonb_agg(to_jsonb(h) || jsonb_build_object('email', u.email) order by h.updated_at desc) from public.account_holds h left join auth.users u on u.id = h.user_id), '[]'::jsonb),
    'accounts', coalesce((select jsonb_agg(jsonb_build_object('user_id', u.id, 'email', u.email, 'created_at', u.created_at, 'seller_store', case when s.id is null then null else jsonb_build_object('id', s.id, 'name', s.name, 'approval_status', s.approval_status) end, 'buyer_profile', case when b.id is null then null else jsonb_build_object('full_name', b.full_name, 'whatsapp', b.whatsapp) end, 'hold', case when h.user_id is null then null else jsonb_build_object('role', h.role, 'status', h.status, 'reason', h.reason) end) order by u.created_at desc) from auth.users u left join public.stores s on s.owner_id = u.id left join public.buyer_profiles b on b.user_id = u.id left join public.account_holds h on h.user_id = u.id), '[]'::jsonb),
    'demo_requests', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.demo_requests d limit 100), '[]'::jsonb),
    'launch_waitlist', coalesce((select jsonb_agg(to_jsonb(w) - 'normalized_email' order by w.created_at desc) from public.launch_waitlist w limit 500), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.admin_dashboard_snapshot() to authenticated;
notify pgrst, 'reload schema';
