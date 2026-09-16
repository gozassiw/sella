-- Sella Stage 75: buyer Trust Store acknowledgement evidence.
-- Trust mutations are server-only: the API verifies the signed notice nonce,
-- then calls the service-role-only RPC.

create table if not exists public.buyer_store_trust_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  acknowledged_at timestamptz default now(),
  notice_version text not null,
  status text not null default 'active' check (status in ('active', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buyer_id, store_id)
);

create index if not exists buyer_store_trust_ack_buyer_idx
  on public.buyer_store_trust_acknowledgements(buyer_id, updated_at desc);

-- Grandfather existing relationships without changing their timestamps. Removing
-- trust later only changes the relationship/evidence status, never order history.
insert into public.buyer_store_trust_acknowledgements(
  buyer_id, store_id, acknowledged_at, notice_version, status, created_at, updated_at
)
select f.user_id, f.store_id, null, 'legacy-before-notice', 'active', f.created_at, f.created_at
from public.buyer_store_follows f
on conflict (buyer_id, store_id) do nothing;

alter table public.buyer_store_trust_acknowledgements enable row level security;

drop policy if exists "trust acknowledgements: buyer read own" on public.buyer_store_trust_acknowledgements;
create policy "trust acknowledgements: buyer read own"
  on public.buyer_store_trust_acknowledgements
  for select to authenticated
  using (buyer_id = auth.uid());

alter table public.buyer_store_follows enable row level security;
drop policy if exists "trusted stores: buyer read own" on public.buyer_store_follows;
create policy "trusted stores: buyer read own"
  on public.buyer_store_follows for select to authenticated
  using (user_id = auth.uid());

-- Keep reads used by buyer dashboards, but do not allow browser clients or sellers
-- to write either the live relationship or its acknowledgement evidence.
revoke insert, update, delete, truncate, references, trigger on table public.buyer_store_follows from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.buyer_store_trust_acknowledgements from anon, authenticated;
grant select on table public.buyer_store_follows, public.buyer_store_trust_acknowledgements to authenticated;

-- The previous two-argument RPC accepted follow=true without evidence. Remove it
-- so legacy callers cannot bypass the first-time acknowledgement requirement.
drop function if exists public.set_store_trust(uuid, boolean);
drop function if exists public.set_store_trust(uuid, boolean, boolean, text);

create or replace function public.set_store_trust(
  p_buyer_id uuid,
  p_store_id uuid,
  p_trusted boolean,
  p_acknowledged boolean,
  p_notice_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_store public.stores%rowtype;
  v_now timestamptz := now();
begin
  if p_buyer_id is null or not exists (select 1 from auth.users where id = p_buyer_id) then
    raise exception 'Buyer account not found.';
  end if;

  if p_trusted is false then
    delete from public.buyer_store_follows where user_id=p_buyer_id and store_id=p_store_id;
    update public.buyer_store_trust_acknowledgements set status='removed',updated_at=v_now where buyer_id=p_buyer_id and store_id=p_store_id;
    return jsonb_build_object('following',false);
  end if;
  if p_trusted is null then raise exception 'Trust choice is required'; end if;
  if public.is_account_held(p_buyer_id) then
    raise exception 'Your account is on hold. Trusting stores is paused while Sella Team reviews it.';
  end if;

  select * into v_store
  from public.stores
  where id = p_store_id
    and is_published = true
    and approval_status = 'approved' and coalesce(seller_code_active,true) and not coalesce(order_access_suspended,false);

  if not found then
    raise exception 'Store not found.';
  end if;

  if p_trusted is true then
    if p_acknowledged is not true or p_notice_version is distinct from 'trust-store-2026-09-16' then
      raise exception 'Trust Store acknowledgement is required.';
    end if;

    if exists(select 1 from public.buyer_store_follows where user_id=p_buyer_id and store_id=p_store_id) then
      return jsonb_build_object('following',true);
    end if;
    insert into public.buyer_store_trust_acknowledgements(
      buyer_id, store_id, acknowledged_at, notice_version, status, updated_at
    ) values (
      p_buyer_id, p_store_id, v_now, p_notice_version, 'active', v_now
    )
    on conflict (buyer_id, store_id) do update set
      acknowledged_at = excluded.acknowledged_at,
      notice_version = excluded.notice_version,
      status = 'active',
      updated_at = excluded.updated_at;

    insert into public.buyer_store_follows(user_id, store_id)
    values (p_buyer_id, p_store_id)
    on conflict (user_id, store_id) do nothing;
    return jsonb_build_object('following', true);
  end if;

  delete from public.buyer_store_follows
  where user_id = p_buyer_id and store_id = p_store_id;

  -- Keep evidence without claiming that a currently active relationship exists.
  update public.buyer_store_trust_acknowledgements
  set status = 'removed', updated_at = v_now
  where buyer_id = p_buyer_id and store_id = p_store_id;

  return jsonb_build_object('following', false);
end;
$$;

revoke all on function public.set_store_trust(uuid, uuid, boolean, boolean, text) from public;
grant execute on function public.set_store_trust(uuid, uuid, boolean, boolean, text) to service_role;

notify pgrst, 'reload schema';
