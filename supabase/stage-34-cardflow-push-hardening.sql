-- Sella Stage 34: Cardflow-aligned web push subscription hardening.
-- Keep the raw subscription for compatibility, while indexing the Web Push encryption fields explicitly.

alter table public.push_subscriptions
  add column if not exists p256dh_key text,
  add column if not exists auth_key text,
  add column if not exists last_success_at timestamptz,
  add column if not exists disabled_at timestamptz;

update public.push_subscriptions
set p256dh_key = coalesce(p256dh_key, subscription->'keys'->>'p256dh'),
    auth_key = coalesce(auth_key, subscription->'keys'->>'auth')
where p256dh_key is null or auth_key is null;

create index if not exists push_subscriptions_active_user_idx on public.push_subscriptions(user_id, updated_at desc) where disabled_at is null;
notify pgrst, 'reload schema';
