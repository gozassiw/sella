-- Sella Stage 43: save push subscriptions through a protected RPC.
-- This avoids direct PostgREST table-write permission failures while still
-- binding every subscription to the authenticated Supabase user.

create or replace function public.save_push_subscription(
  p_endpoint text,
  p_subscription jsonb,
  p_user_agent text default null,
  p_p256dh_key text default null,
  p_auth_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(p_endpoint), '') is null or p_subscription is null then
    raise exception 'A valid push subscription is required';
  end if;

  insert into public.push_subscriptions(
    user_id,
    endpoint,
    subscription,
    user_agent,
    p256dh_key,
    auth_key,
    disabled_at,
    updated_at
  ) values (
    v_user_id,
    p_endpoint,
    p_subscription,
    p_user_agent,
    p_p256dh_key,
    p_auth_key,
    null,
    now()
  )
  on conflict (endpoint) do update set
    user_id = excluded.user_id,
    subscription = excluded.subscription,
    user_agent = excluded.user_agent,
    p256dh_key = excluded.p256dh_key,
    auth_key = excluded.auth_key,
    disabled_at = null,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.save_push_subscription(text, jsonb, text, text, text) from public;
grant execute on function public.save_push_subscription(text, jsonb, text, text, text) to authenticated;

notify pgrst, 'reload schema';
