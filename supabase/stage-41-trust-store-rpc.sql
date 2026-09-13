-- Sella Stage 41: protected trusted-store mutation.
-- The client must not rely on a direct upsert because an upsert requires
-- UPDATE privileges when the trust row already exists.

create or replace function public.set_store_trust(
  p_store_id uuid,
  p_trusted boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_store public.stores%rowtype;
begin
  if v_user_id is null then
    raise exception 'Please create a buyer account first.';
  end if;

  if public.is_account_held(v_user_id) then
    raise exception 'Your account is on hold. Trusting stores is paused while Sella Team reviews it.';
  end if;

  select * into v_store
  from public.stores
  where id = p_store_id
    and is_published = true
    and approval_status = 'approved';

  if not found then
    raise exception 'Store not found.';
  end if;

  if coalesce(p_trusted, true) then
    insert into public.buyer_store_follows(user_id, store_id)
    values (v_user_id, p_store_id)
    on conflict (user_id, store_id) do nothing;
    return jsonb_build_object('following', true);
  end if;

  delete from public.buyer_store_follows
  where user_id = v_user_id and store_id = p_store_id;
  return jsonb_build_object('following', false);
end;
$$;

revoke all on function public.set_store_trust(uuid, boolean) from public;
grant execute on function public.set_store_trust(uuid, boolean) to authenticated;
