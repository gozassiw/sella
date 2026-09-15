-- Sella Stage 61: public demo requests with protected admin visibility.
create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  whatsapp text not null,
  requested_day date not null,
  time_slot text not null,
  status text not null default 'pending' check (status in ('pending','contacted','completed','cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists demo_requests_created_idx on public.demo_requests(created_at desc);
create index if not exists demo_requests_day_idx on public.demo_requests(requested_day, time_slot);
alter table public.demo_requests enable row level security;

-- Public visitors never receive direct table access. The booking API uses the
-- server-only Supabase service role after validating the submitted fields.
revoke all on public.demo_requests from anon, authenticated;

alter table public.demo_requests owner to postgres;

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
    'demo_requests', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.demo_requests d limit 100), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.admin_dashboard_snapshot() to authenticated;
notify pgrst, 'reload schema';
