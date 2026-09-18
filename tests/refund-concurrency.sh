#!/usr/bin/env bash
# Disposable integration test. Requires a fully migrated disposable
# PostgreSQL/Supabase database and a privileged test role; no production DB.
set -euo pipefail
: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to a disposable migrated database}"
tmp="$(mktemp -d)"
pid=""
cleanup() {
  if [[ -n "$pid" ]]; then kill "$pid" 2>/dev/null || true; fi
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL' || true
begin;
delete from public.withdrawals where id='00000000-0000-0000-0000-000000000038';
delete from public.refund_obligations where order_id='00000000-0000-0000-0000-000000000036';
delete from public.order_items where order_id='00000000-0000-0000-0000-000000000036';
delete from public.orders where id='00000000-0000-0000-0000-000000000036';
delete from public.products where id='00000000-0000-0000-0000-000000000035';
delete from public.buyer_wallets where id='00000000-0000-0000-0000-000000000034';
delete from public.wallets where id='00000000-0000-0000-0000-000000000033';
delete from public.stores where id='00000000-0000-0000-0000-000000000030';
delete from public.buyer_profiles where user_id='00000000-0000-0000-0000-000000000032';
delete from public.platform_admins where email='concurrency-admin@example.invalid';
delete from auth.users where id in ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000037');
commit;
SQL
  rm -rf "$tmp"
}
trap cleanup EXIT

psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 >"$tmp/setup.log" <<'SQL'
begin;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000031','authenticated','authenticated','concurrency-seller@example.invalid','x',now(),'{}','{}'),
       ('00000000-0000-0000-0000-000000000032','authenticated','authenticated','concurrency-buyer@example.invalid','x',now(),'{}','{}')
on conflict (id) do nothing;
insert into public.buyer_profiles(user_id,full_name,whatsapp) values ('00000000-0000-0000-0000-000000000032','Concurrency Buyer','+2340000000032') on conflict (user_id) do nothing;
insert into public.stores(id,owner_id,name,slug,is_published) values ('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000031','Concurrency Store','concurrency-fixture',true) on conflict (id) do nothing;
insert into public.wallets(id,store_id,available,held) values ('00000000-0000-0000-0000-000000000033','00000000-0000-0000-0000-000000000030',0,0) on conflict (id) do update set available=0;
insert into public.buyer_wallets(id,user_id,balance) values ('00000000-0000-0000-0000-000000000034','00000000-0000-0000-0000-000000000032',0) on conflict (id) do nothing;
insert into public.products(id,store_id,name,price,stock) values ('00000000-0000-0000-0000-000000000035','00000000-0000-0000-0000-000000000030','Concurrency Product',20,1) on conflict (id) do nothing;
insert into public.orders(id,store_id,buyer_id,channel,status,payment_status,subtotal,delivery_fee,total,commission,net_to_seller,payment_method,payment_reference,order_code,refund_status)
values ('00000000-0000-0000-0000-000000000036','00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000032','website','pending','paid',20,0,20,2,18,'wallet','concurrency-payment','RF-CONCURRENCY','not_required');
insert into public.order_items(order_id,product_id,name,price,quantity) values ('00000000-0000-0000-0000-000000000036','00000000-0000-0000-0000-000000000035','Concurrency Product',20,1);
insert into public.platform_admins(email) values ('concurrency-admin@example.invalid') on conflict do nothing;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000037','authenticated','authenticated','concurrency-admin@example.invalid','x',now(),'{}','{}') on conflict (id) do nothing;
insert into public.withdrawals(id,store_id,amount,fee,payout_amount,status,bank_name,account_number,account_name,receipt_path,created_at)
values ('00000000-0000-0000-0000-000000000038','00000000-0000-0000-0000-000000000030',10,0,10,'pending','Concurrency Bank','0000000038','Concurrency Seller','fixture/concurrency.pdf',now()-interval '1 hour');
commit;
SQL

# Establish the review state in its own committed transaction before racing.
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
begin;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000037","role":"authenticated","email":"concurrency-admin@example.invalid"}',true);
select public.admin_review_withdrawal('00000000-0000-0000-0000-000000000038','processing','{}','concurrency review');
commit;
SQL

# A owns the store advisory lock while the refund obligation is committed.
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 >"$tmp/a.log" <<'SQL' &
begin;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000031","role":"authenticated","email":"concurrency-seller@example.invalid"}',true);
select public.cancel_order_and_refund('00000000-0000-0000-0000-000000000036','concurrency cancellation');
select pg_sleep(3);
commit;
SQL
pid=$!
sleep 1

# B supplies the complete Stage-77 confirmation payload. Its paid transition
# must fail specifically after A commits, not because confirmation is absent.
if psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 >"$tmp/b.log" 2>&1 <<'SQL'
begin;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000037","role":"authenticated","email":"concurrency-admin@example.invalid"}',true);
select public.admin_review_withdrawal('00000000-0000-0000-0000-000000000038','paid',
 jsonb_build_object('bank_success_checked',true,'channel','fixture-bank','reference','fixture-concurrency','paid_at',now()::text,'amount',10),'concurrency paid');
commit;
SQL
then
  echo "ERROR: payout unexpectedly completed" >&2
  kill "$pid" 2>/dev/null || true
  exit 1
fi
grep -q "Unresolved refund obligation blocks payout completion" "$tmp/b.log" || {
  echo "ERROR: unrelated payout failure" >&2; cat "$tmp/b.log" >&2; exit 1;
}
wait "$pid"

psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if (select status from public.withdrawals where id='00000000-0000-0000-0000-000000000038') <> 'processing' then raise exception 'withdrawal status changed'; end if;
  if (select count(*) from public.refund_obligations where order_id='00000000-0000-0000-0000-000000000036') <> 1
     or (select count(*) from public.wallet_transactions where order_id='00000000-0000-0000-0000-000000000036' and kind='refund') <> 0
     or (select count(*) from public.buyer_wallet_transactions where order_id='00000000-0000-0000-0000-000000000036') <> 0 then
    raise exception 'refund financial rows are not exactly one unresolved obligation';
  end if;
end $$;
SQL
