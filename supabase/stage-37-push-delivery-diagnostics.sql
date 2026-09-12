-- Sella Stage 37: record the provider result for every phone push attempt.

alter table public.push_subscriptions
  add column if not exists last_failure_at timestamptz,
  add column if not exists last_error text;

comment on column public.push_subscriptions.last_error is
  'Last non-secret web-push provider error for this endpoint.';

create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id, disabled_at, updated_at desc);

create or replace function public.record_push_delivery_failure(
  p_subscription_id uuid,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.push_subscriptions
  set last_failure_at = now(),
      last_error = left(coalesce(p_error, 'Unknown push provider error'), 500),
      updated_at = now()
  where id = p_subscription_id;
end;
$$;

create or replace function public.record_push_delivery_success(p_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.push_subscriptions
  set last_success_at = now(),
      last_failure_at = null,
      last_error = null,
      disabled_at = null,
      updated_at = now()
  where id = p_subscription_id;
end;
$$;

revoke all on function public.record_push_delivery_failure(uuid, text) from public, anon, authenticated;
revoke all on function public.record_push_delivery_success(uuid) from public, anon, authenticated;
grant execute on function public.record_push_delivery_failure(uuid, text) to service_role;
grant execute on function public.record_push_delivery_success(uuid) to service_role;

notify pgrst, 'reload schema';
