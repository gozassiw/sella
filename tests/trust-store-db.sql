
-- Run against the disposable sella_trust_test database only.
begin;
create extension if not exists pgcrypto;
create schema if not exists auth;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
create table if not exists auth.users(id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table if not exists public.stores(id uuid primary key, owner_id uuid not null references auth.users(id), name text not null, is_published boolean not null default true, approval_status text not null default 'approved');
alter table public.stores add column seller_code_active boolean default true;
alter table public.stores add column order_access_suspended boolean default false;
create table if not exists public.buyer_store_follows(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), store_id uuid not null references public.stores(id), created_at timestamptz not null default now(), unique(user_id, store_id));
create table if not exists public.orders(id uuid primary key, buyer_id uuid references auth.users(id), store_id uuid references public.stores(id), total numeric not null);
create table if not exists public.payment_records(id uuid primary key, order_id uuid references public.orders(id), amount numeric not null);
create table if not exists public.complaints(id uuid primary key, buyer_id uuid references auth.users(id), store_id uuid references public.stores(id), body text not null);
create or replace function public.is_account_held(p_user_id uuid) returns boolean language sql stable as $$ select false $$;
insert into auth.users(id,email) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','seller@example.test'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','buyer@example.test'),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','other@example.test') on conflict do nothing;
insert into public.stores(id,owner_id,name) values
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Fixture Store'),
 ('22222222-2222-2222-2222-222222222222','cccccccc-cccc-cccc-cccc-cccccccccccc','Grandfathered Store') on conflict do nothing;
-- Historical trust must be retained as active acknowledgement evidence.
insert into public.buyer_store_follows(user_id,store_id,created_at) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','22222222-2222-2222-2222-222222222222',now()-interval '1 day') on conflict do nothing;
\i /home/ubuntu/sella-repo/supabase/stage-75-trust-acknowledgement.sql
commit;

-- Server-only RPC: authenticated can read its own rows but cannot write or invoke mutation.
set role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);
do $$ begin
  begin insert into public.buyer_store_follows(user_id,store_id) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111'); raise exception 'direct follow insert unexpectedly succeeded'; exception when insufficient_privilege then null; end;
  begin perform public.set_store_trust('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111',true,true,'trust-store-2026-09-16'); raise exception 'authenticated RPC unexpectedly succeeded'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Service role performs the validated server mutation.
set role service_role;
select public.set_store_trust('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111',true,true,'trust-store-2026-09-16');
select public.set_store_trust('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111',true,true,'trust-store-2026-09-16');
select public.set_store_trust('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111',false,false,null);
reset role;

-- Assertions: no bypass, uniqueness, grandfathering, and history preservation.
do $$ begin
  if exists(select 1 from public.buyer_store_trust_acknowledgements where notice_version='legacy-before-notice' and acknowledged_at is not null) then raise exception 'Historical trust falsely claims notice acknowledgement'; end if;
  if (select count(*) from public.buyer_store_follows where user_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and store_id='11111111-1111-1111-1111-111111111111') <> 0 then raise exception 'removed trust still active'; end if;
  if (select count(*) from public.buyer_store_trust_acknowledgements where buyer_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and store_id='11111111-1111-1111-1111-111111111111') <> 1 then raise exception 'duplicate acknowledgement evidence'; end if;
  if (select status from public.buyer_store_trust_acknowledgements where buyer_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and store_id='11111111-1111-1111-1111-111111111111') <> 'removed' then raise exception 'removal status missing'; end if;
  if (select status from public.buyer_store_trust_acknowledgements where buyer_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and store_id='22222222-2222-2222-2222-222222222222') <> 'active' then raise exception 'existing trust was not grandfathered'; end if;
  insert into public.orders(id,buyer_id,store_id,total) values ('33333333-3333-3333-3333-333333333333','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111',100);
  insert into public.payment_records(id,order_id,amount) values ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333',100);
  insert into public.complaints(id,buyer_id,store_id,body) values ('55555555-5555-5555-5555-555555555555','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111','test');
  set role service_role; perform public.set_store_trust('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111',false,false,null); reset role;
  if (select count(*) from public.orders) <> 1 or (select count(*) from public.payment_records) <> 1 or (select count(*) from public.complaints) <> 1 then raise exception 'financial or complaint history was deleted'; end if;
  raise notice 'PASS trust DB: auth dependency, grants/RLS, no legacy bypass, unique trust, grandfathering, actor-safe server RPC, removal history preservation';
end $$;
