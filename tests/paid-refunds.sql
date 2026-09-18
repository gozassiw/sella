-- Disposable integration test. Requires a fully migrated Supabase/PostgreSQL
-- database and a privileged test role (including auth schema write access).
-- Run only against that disposable database; every fixture is rolled back.
-- psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f tests/paid-refunds.sql
begin;

-- Stable users make this test repeatable without relying on pre-existing rows.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
 ('00000000-0000-0000-0000-000000000001','authenticated','authenticated','refund-seller@example.invalid','x',now(),'{}','{}'),
 ('00000000-0000-0000-0000-000000000002','authenticated','authenticated','refund-buyer@example.invalid','x',now(),'{}','{}'),
 ('00000000-0000-0000-0000-000000000003','authenticated','authenticated','refund-admin@example.invalid','x',now(),'{}','{}')
on conflict (id) do nothing;
insert into public.buyer_profiles(user_id,full_name,whatsapp)
values ('00000000-0000-0000-0000-000000000002','Refund Test Buyer','+2340000000000')
on conflict (user_id) do update set full_name=excluded.full_name;
insert into public.platform_admins(email) values ('refund-admin@example.invalid') on conflict do nothing;

insert into public.stores(id,owner_id,name,slug,is_published)
values ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001','Refund Fixture Store','refund-fixture',true)
on conflict (id) do nothing;
insert into public.wallets(id,store_id,available,held)
values ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000010',100,0)
on conflict (id) do update set available=100,held=0;
insert into public.buyer_wallets(id,user_id,balance)
values ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000002',0)
on conflict (id) do update set balance=0;
insert into public.products(id,store_id,name,price,stock)
values ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000010','Refund Fixture Product',10,10)
on conflict (id) do update set stock=10;

-- Five independent orders cover unpaid, wallet-paid, transfer-paid, shortage,
-- and two simultaneous obligations.
insert into public.orders
 (id,store_id,buyer_id,channel,status,payment_status,subtotal,delivery_fee,total,
  commission,net_to_seller,payment_method,payment_reference,order_code,refund_status)
values
 ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000002','website','pending','unpaid',10,0,10,1,9,'wallet','unpaid-ref','RF-UNPAID','not_required'),
 ('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000002','website','pending','paid',40,0,40,4,36,'wallet','wallet-ref','RF-WALLET','not_required'),
 ('00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000002','website','pending','paid',20,0,20,2,18,'transfer','transfer-ref','RF-TRANSFER','not_required'),
 ('00000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000002','website','pending','paid',50,0,50,5,45,'wallet','short-ref','RF-SHORT','not_required'),
 ('00000000-0000-0000-0000-000000000105','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000002','website','pending','paid',15,0,15,1.5,13.5,'wallet','obligation-ref','RF-OBLIG','not_required')
on conflict (id) do nothing;
insert into public.order_items(order_id,product_id,name,price,quantity)
select id,'00000000-0000-0000-0000-000000000020','Refund Fixture Product',10,1
from public.orders where id in ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-000000000105');

insert into public.withdrawals
 (id,store_id,amount,fee,payout_amount,status,bank_name,account_number,account_name,receipt_path,created_at,
  processed_at,settlement_checked_by,settlement_checked_at,settlement_channel,settlement_reference,settlement_paid_at)
values
 ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000010',10,0,10,'pending','Fixture Bank','0000000000','Refund Seller','fixture/receipt.pdf',now()-interval '1 hour',NULL,NULL,NULL,NULL,NULL,NULL),
  ('00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000010',11,0,11,'paid','Fixture Bank','0000000001','Refund Seller','fixture/final.pdf',now()-interval '2 hours',now(),'00000000-0000-0000-0000-000000000003',now(),'fixture','already-final',now());

do $$
declare r jsonb; rid uuid; n integer; before_balance numeric; before_stock integer; eligible_funds_applied numeric;
begin
  -- Seller context: Supabase auth.uid() is derived from these JWT claims.
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","email":"refund-seller@example.invalid"}',true);
  select stock into before_stock from public.products where id='00000000-0000-0000-0000-000000000020';
  r:=public.cancel_order_and_refund('00000000-0000-0000-0000-000000000101','unpaid fixture');
  if r->>'refund_status' <> 'not_required' then raise exception 'unpaid cancellation did not avoid obligation'; end if;
  if (select stock from public.products where id='00000000-0000-0000-0000-000000000020') <> before_stock+1 then raise exception 'unpaid cancellation did not restore stock'; end if;
  if exists(select 1 from public.refund_obligations where order_id='00000000-0000-0000-0000-000000000101') then raise exception 'unpaid cancellation created obligation'; end if;

  r:=public.cancel_order_and_refund('00000000-0000-0000-0000-000000000102','wallet paid fixture');
  if r->>'status' <> 'refunded' or r->>'credited_now' <> 'true' then raise exception 'wallet refund not completed'; end if;
  if (select available from public.wallets where id='00000000-0000-0000-0000-000000000011') <> 64 then raise exception 'wallet debit was not exact'; end if;
  rid:=(r->>'refund_id')::uuid;
  if (select count(*) from public.wallet_transactions where refund_id=rid and kind='refund')<>1 then raise exception 'wallet refund ledger count'; end if;
  if (select count(*) from public.buyer_wallet_transactions where order_id='00000000-0000-0000-0000-000000000102' and amount=40)<>1 then raise exception 'buyer refund transaction count'; end if;
  if (select count(*) from public.refund_accounting where refund_id=rid)<>3
     or not exists(select 1 from public.refund_accounting where refund_id=rid and entry_type='seller_debit' and amount=36)
     or not exists(select 1 from public.refund_accounting where refund_id=rid and entry_type='commission_reversal' and amount=4)
     or not exists(select 1 from public.refund_accounting where refund_id=rid and entry_type='buyer_credit' and amount=40) then raise exception 'wallet accounting legs are wrong'; end if;

  r:=public.cancel_order_and_refund('00000000-0000-0000-0000-000000000103','transfer paid fixture');
  if r->>'status' <> 'refunded' then raise exception 'transfer refund not completed'; end if;

  -- Force a deterministic shortage, then verify the persisted snapshot and no movement.
  update public.wallets set available=20 where id='00000000-0000-0000-0000-000000000011';
  select balance into before_balance from public.buyer_wallets where id='00000000-0000-0000-0000-000000000012';
  r:=public.cancel_order_and_refund('00000000-0000-0000-0000-000000000104','shortage fixture');
  if r->>'status' <> 'pending_funding' then raise exception 'shortage did not remain pending'; end if;
  rid:=(r->>'refund_id')::uuid;
  -- available_seller_funds is the snapshot; eligible_funds_applied is zero
  -- because the RPC must not apply a partial contribution.
  select coalesce(sum(-amount) filter (where kind='refund'),0) into eligible_funds_applied
    from public.wallet_transactions where refund_id=rid;
  if (select available_seller_funds from public.refund_obligations where id=rid)<>20
     or eligible_funds_applied<>0
     or (select seller_contribution from public.refund_obligations where id=rid)<>45
     or (select outstanding_seller_contribution from public.refund_obligations where id=rid)<>45
     or (select count(*) from public.wallet_transactions where refund_id=rid)<>0
     or (select balance from public.buyer_wallets where id='00000000-0000-0000-0000-000000000012')<>before_balance then raise exception 'shortage moved money or lost snapshot'; end if;
  update public.wallets set available=45 where id='00000000-0000-0000-0000-000000000011';
  r:=public.retry_refund_from_wallet(rid);
  if r->>'status' <> 'refunded' or r->>'credited_now' <> 'true' then raise exception 'retry did not credit'; end if;
  r:=public.retry_refund_from_wallet(rid);
  if r->>'credited_now' <> 'false' or (select count(*) from public.wallet_transactions where refund_id=rid)<>1
     or (select count(*) from public.buyer_wallet_transactions where order_id='00000000-0000-0000-0000-000000000104')<>1 then raise exception 'retry replay duplicated money'; end if;

  -- A duplicate cancel is rejected and cannot restock or credit a second time.
  select stock into before_stock from public.products where id='00000000-0000-0000-0000-000000000020';
  select count(*) into n from public.buyer_wallet_transactions where order_id='00000000-0000-0000-0000-000000000102';
  begin perform public.cancel_order_and_refund('00000000-0000-0000-0000-000000000102','duplicate'); raise exception 'duplicate cancel accepted'; exception when others then if sqlerrm='duplicate cancel accepted' then raise; end if; end;
  if (select stock from public.products where id='00000000-0000-0000-0000-000000000020')<>before_stock or (select count(*) from public.buyer_wallet_transactions where order_id='00000000-0000-0000-0000-000000000102')<>n then raise exception 'duplicate cancel changed financial rows'; end if;

  r:=public.cancel_order_and_refund('00000000-0000-0000-0000-000000000105','blocking obligation');
  if r->>'status' <> 'pending_funding' then raise exception 'obligation fixture unexpectedly funded'; end if;
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","email":"refund-admin@example.invalid"}',true);
  perform public.admin_review_withdrawal('00000000-0000-0000-0000-000000000201','processing','{}','review');
  if (select status from public.withdrawals where id='00000000-0000-0000-0000-000000000201')<>'processing' then raise exception 'processing transition did not commit'; end if;
  begin
    perform public.admin_review_withdrawal('00000000-0000-0000-0000-000000000201','paid',
      jsonb_build_object('bank_success_checked',true,'channel','fixture-bank','reference','fixture-settlement','paid_at',now()::text,'amount',10),'paid');
    raise exception 'unresolved refund did not block payout';
  exception when others then
    if position('Unresolved refund obligation blocks payout completion' in sqlerrm)=0 then raise; end if;
  end;
  if (select status from public.withdrawals where id='00000000-0000-0000-0000-000000000201')<>'processing' then raise exception 'blocked payout changed status'; end if;
  -- Final payouts are immutable, including when an unresolved obligation exists.
  if (select (public.admin_review_withdrawal('00000000-0000-0000-0000-000000000202','paid','{}','replay')->>'changed')::boolean) then raise exception 'completed payout changed'; end if;
  -- Direct authenticated order updates must remain revoked.
  begin
    set role authenticated;
    update public.orders set total=999 where id='00000000-0000-0000-0000-000000000105';
    reset role;
    raise exception 'direct authenticated order update was permitted';
  exception when insufficient_privilege then reset role; end;
end $$;
rollback;