\set ON_ERROR_STOP on
-- Run ONLY in disposable local sella_safety_test, never against production.
create extension if not exists pgcrypto;
create schema if not exists auth;
do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; end $$;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create function public.is_platform_admin() returns boolean language sql stable as $$ select coalesce(current_setting('test.admin',true),'false')='true' $$;
create table stores(id uuid primary key,owner_id uuid references auth.users);
create table wallets(id uuid primary key,store_id uuid unique references stores,available numeric);
create table withdrawals(id uuid primary key,store_id uuid references stores,amount numeric,fee numeric,payout_amount numeric,bank_name text,account_number text,account_name text,status text default 'pending' check(status in ('pending','processing','paid','sent','rejected')),note text,created_at timestamptz default now(),processed_at timestamptz,receipt_path text,receipt_name text,receipt_uploaded_at timestamptz);
create table wallet_transactions(id uuid default gen_random_uuid(),wallet_id uuid,kind text,amount numeric,note text,status text);
create table admin_audit_logs(id uuid default gen_random_uuid(),admin_user_id uuid,action text,entity text,entity_id uuid,details jsonb);
grant usage on schema public,auth to authenticated,anon;
grant select,insert,update,delete,truncate,references,trigger on withdrawals to authenticated;
\ir ../supabase/stage-77-withdrawal-confirmation-safety.sql
create function expect_error(q text, expected text) returns void language plpgsql as $$ begin begin execute q; exception when others then if sqlerrm not ilike '%'||expected||'%' then raise exception 'Wrong failure: % expected %',sqlerrm,expected; end if; return; end; raise exception 'Expected failure for %',q; end $$;
insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into stores values('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222');
insert into wallets values('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333',10000);
insert into withdrawals(id,store_id,amount,fee,payout_amount,created_at,receipt_path) values
('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333',1000,100,900,now()-interval '1 day','private/receipt'),
('66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333',1000,100,900,now()-interval '1 day',null),
('77777777-7777-4777-8777-777777777777','33333333-3333-4333-8333-333333333333',1000,100,900,now()-interval '1 day','private/receipt');
select set_config('test.uid','11111111-1111-4111-8111-111111111111',false);
select expect_error($q$ select admin_review_withdrawal('55555555-5555-4555-8555-555555555555','processing') $q$,'Admin access required');
select set_config('test.admin','true',false);
select expect_error($q$ update withdrawals set status='paid' where id='55555555-5555-4555-8555-555555555555' $q$,'reviewed withdrawal');
select admin_review_withdrawal('55555555-5555-4555-8555-555555555555','processing');
select expect_error($q$ select admin_process_withdrawal('55555555-5555-4555-8555-555555555555','paid') $q$,'Refresh Admin');
select expect_error($q$ select admin_review_withdrawal('55555555-5555-4555-8555-555555555555','paid') $q$,'bank/provider');
select expect_error($q$ select admin_review_withdrawal('55555555-5555-4555-8555-555555555555','paid',jsonb_build_object('bank_success_checked',true,'channel','Test bank','reference','TESTREF','paid_at',now(),'amount',1000)) $q$,'net payout');
select admin_review_withdrawal('55555555-5555-4555-8555-555555555555','paid',jsonb_build_object('bank_success_checked',true,'channel','Test bank','reference','TESTREF','paid_at',now(),'amount',900));
select admin_review_withdrawal('55555555-5555-4555-8555-555555555555','paid');
select expect_error($q$ select admin_review_withdrawal('55555555-5555-4555-8555-555555555555','rejected','{"not_settled_checked":true}','wrong reversal') $q$,'Final withdrawals');
select expect_error($q$ select admin_review_withdrawal('55555555-5555-4555-8555-555555555555','processing') $q$,'Final withdrawals');
select admin_review_withdrawal('66666666-6666-4666-8666-666666666666','processing');
select expect_error($q$ select admin_review_withdrawal('66666666-6666-4666-8666-666666666666','paid',jsonb_build_object('bank_success_checked',true)) $q$,'Attach the payment');
select expect_error($q$ select admin_review_withdrawal('66666666-6666-4666-8666-666666666666','rejected') $q$,'not settled');
select admin_review_withdrawal('66666666-6666-4666-8666-666666666666','rejected','{"not_settled_checked":true}','Bank confirmed transfer failed');
select admin_review_withdrawal('66666666-6666-4666-8666-666666666666','rejected','{"not_settled_checked":true}','Repeat cancel');
select expect_error($q$ select admin_review_withdrawal('66666666-6666-4666-8666-666666666666','processing') $q$,'Final withdrawals');
select admin_review_withdrawal('77777777-7777-4777-8777-777777777777','processing');
select expect_error($q$ select admin_review_withdrawal('77777777-7777-4777-8777-777777777777','paid',jsonb_build_object('bank_success_checked',true,'channel','Test bank','reference','TESTREF','paid_at',now(),'amount',900)) $q$,'duplicate key');
select expect_error($q$ update withdrawals set amount=999 where id='77777777-7777-4777-8777-777777777777' $q$,'cannot be edited');
set role authenticated;
select expect_error($q$ update withdrawals set status='paid' $q$,'permission denied');
reset role;
do $$ begin
 if (select available from wallets limit 1)<>11000 then raise exception 'Balance credited more than once'; end if;
 if (select count(*) from wallet_transactions)<>1 then raise exception 'Duplicate reversal ledger entry'; end if;
 if (select count(*) from admin_audit_logs where action='withdrawal_review')<>5 then raise exception 'Missing/duplicate audit event'; end if;
 if (select count(*) from get_public_verified_store_ids())<>0 then raise exception 'Discovery still enumerates'; end if;
 raise notice 'PASS payout tests: role checks, legacy bypass, no receipt-only payment, exact net, terminal states, duplicate reference, idempotent retry, single refund, audit and no discovery';
end $$;
