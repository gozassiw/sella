-- Sella Stage 79: seller-funded full refunds for paid seller-side cancellations.
-- The seller must fund the full original order amount. Sella's original
-- commission is not reversed. Buyer refunds are internal Sella wallet credits.

create table if not exists public.refund_obligations (
  id uuid primary key default gen_random_uuid(),
  refund_reference text not null unique default ('SFR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  seller_id uuid not null references auth.users(id) on delete restrict,
  buyer_id uuid not null references auth.users(id) on delete restrict,
  original_payment_reference text,
  original_payment_method text not null,
  original_amount numeric(12,2) not null check (original_amount > 0),
  original_commission numeric(12,2) not null default 0 check (original_commission >= 0),
  seller_net_proceeds numeric(12,2) not null default 0 check (seller_net_proceeds >= 0),
  refund_due numeric(12,2) not null check (refund_due > 0),
  seller_available_at_cancel numeric(12,2) not null default 0 check (seller_available_at_cancel >= 0),
  seller_funding_required numeric(12,2) not null default 0 check (seller_funding_required >= 0),
  seller_funding_received numeric(12,2) not null default 0 check (seller_funding_received >= 0),
  eligible_funds_used numeric(12,2) not null default 0 check (eligible_funds_used >= 0),
  outstanding_seller_contribution numeric(12,2) not null default 0 check (outstanding_seller_contribution >= 0),
  refund_status text not null default 'pending_review' check (refund_status in ('not_required','pending_review','pending_funding','processing','refunded','failed')),
  cancellation_reason text not null,
  linked_withdrawal_id uuid references public.withdrawals(id) on delete set null,
  funding_account_number text,
  funding_account_name text,
  funding_bank_name text,
  funding_account_reference text,
  funding_account_amount numeric(12,2),
  funding_account_expires_at timestamptz,
  last_failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processing_at timestamptz,
  refunded_at timestamptz,
  failed_at timestamptz
);

create index if not exists refund_obligations_seller_status_idx on public.refund_obligations(seller_id, refund_status, created_at desc);
create index if not exists refund_obligations_buyer_idx on public.refund_obligations(buyer_id, created_at desc);
create index if not exists refund_obligations_store_idx on public.refund_obligations(store_id, created_at desc);
create index if not exists refund_obligations_funding_account_idx on public.refund_obligations(funding_account_number, funding_account_reference);

create table if not exists public.refund_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  refund_obligation_id uuid not null references public.refund_obligations(id) on delete restrict,
  entry_type text not null check (entry_type in ('obligation_created','seller_funding','seller_refund_debit','buyer_refund_credit','failed_attempt','admin_note','admin_escalation')),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  idempotency_key text not null unique,
  wallet_transaction_id uuid,
  buyer_wallet_transaction_id uuid,
  provider_reference text,
  actor_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists refund_ledger_entries_refund_idx on public.refund_ledger_entries(refund_obligation_id, created_at asc);

create table if not exists public.refund_funding_payments (
  id uuid primary key default gen_random_uuid(),
  refund_obligation_id uuid not null references public.refund_obligations(id) on delete restrict,
  provider_event_key text not null unique,
  provider_reference text,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'verified' check (status in ('verified','ignored','failed')),
  payload jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists refund_funding_payments_refund_idx on public.refund_funding_payments(refund_obligation_id, created_at asc);

alter table public.wallet_transactions add column if not exists refund_obligation_id uuid references public.refund_obligations(id) on delete set null;
alter table public.buyer_wallet_transactions add column if not exists refund_obligation_id uuid references public.refund_obligations(id) on delete set null;

alter table public.refund_obligations enable row level security;
alter table public.refund_ledger_entries enable row level security;
alter table public.refund_funding_payments enable row level security;
revoke all on public.refund_obligations, public.refund_ledger_entries, public.refund_funding_payments from anon, authenticated;
revoke all on public.refund_obligations, public.refund_ledger_entries, public.refund_funding_payments from public;
grant select, insert, update, delete on public.refund_obligations, public.refund_ledger_entries, public.refund_funding_payments to service_role;
grant update on public.wallet_transactions, public.buyer_wallet_transactions to service_role;

create or replace function public.create_refund_obligation(p_order_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare
  v_order public.orders%rowtype;
  v_wallet public.wallets%rowtype;
  v_refund public.refund_obligations%rowtype;
  v_linked_withdrawal uuid;
  v_available numeric(12,2) := 0;
  v_required numeric(12,2);
  v_refund_due numeric(12,2);
begin
  if auth.uid() is null then raise exception 'Please log in'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'A cancellation reason is required'; end if;
  select o.* into v_order
  from public.orders o
  join public.stores s on s.id = o.store_id
  where o.id = p_order_id and s.owner_id = auth.uid()
  for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status in ('delivered','cancelled') then raise exception 'Delivered or already cancelled orders cannot be cancelled'; end if;

  if v_order.payment_status <> 'paid' then
    update public.products p set stock = p.stock + oi.quantity
    from public.order_items oi where oi.order_id = v_order.id and oi.product_id = p.id;
    update public.orders set status = 'cancelled', escrow_status = 'released', cancelled_at = now(), cancellation_reason = trim(p_reason) where id = v_order.id;
    return jsonb_build_object('success', true, 'refund_required', false, 'order_id', v_order.id, 'status', 'cancelled');
  end if;

  if v_order.buyer_id is null then raise exception 'Paid order has no buyer wallet owner'; end if;
  if exists (select 1 from public.refund_obligations where order_id = v_order.id) then raise exception 'A refund obligation already exists for this order'; end if;
  v_refund_due := greatest(coalesce(nullif(v_order.payment_total, 0), v_order.total), v_order.total);
  select * into v_wallet from public.wallets where store_id = v_order.store_id for update;
  v_available := coalesce(v_wallet.available, 0);
  v_required := greatest(0, round(v_refund_due - v_available, 2));
  select w.id into v_linked_withdrawal from public.withdrawals w where w.store_id = v_order.store_id and w.status in ('pending','processing') order by w.created_at desc limit 1;

  insert into public.refund_obligations(
    order_id, store_id, seller_id, buyer_id, original_payment_reference, original_payment_method,
    original_amount, original_commission, seller_net_proceeds, refund_due, seller_available_at_cancel,
    seller_funding_required, outstanding_seller_contribution, refund_status, cancellation_reason, linked_withdrawal_id
  ) values (
    v_order.id, v_order.store_id, auth.uid(), v_order.buyer_id, v_order.payment_reference, coalesce(v_order.payment_method, 'unknown'),
    round(v_refund_due, 2), coalesce(v_order.commission, 0), coalesce(v_order.net_to_seller, 0), round(v_refund_due, 2), round(v_available, 2),
    v_required, v_required, case when v_required > 0 then 'pending_funding' else 'pending_review' end, trim(p_reason), v_linked_withdrawal
  ) returning * into v_refund;

  update public.products p set stock = p.stock + oi.quantity from public.order_items oi where oi.order_id = v_order.id and oi.product_id = p.id;
  update public.orders set status = 'cancelled', escrow_status = 'released', cancelled_at = now(), cancellation_reason = trim(p_reason) where id = v_order.id;
  insert into public.refund_ledger_entries(refund_obligation_id, entry_type, amount, idempotency_key, actor_id, details)
  values(v_refund.id, 'obligation_created', v_refund.refund_due, 'refund-obligation:' || v_refund.id::text, auth.uid(), jsonb_build_object('original_commission', v_refund.original_commission, 'seller_available_at_cancel', v_refund.seller_available_at_cancel));
  return jsonb_build_object('success', true, 'refund_required', true, 'refund_id', v_refund.id, 'refund_reference', v_refund.refund_reference, 'order_id', v_refund.order_id, 'refund_status', v_refund.refund_status, 'refund_due', v_refund.refund_due, 'available_funds', v_refund.seller_available_at_cancel, 'outstanding_seller_contribution', v_refund.outstanding_seller_contribution, 'linked_withdrawal_id', v_refund.linked_withdrawal_id, 'buyer_id', v_refund.buyer_id, 'seller_id', v_refund.seller_id);
end;
$$;
revoke all on function public.create_refund_obligation(uuid, text) from public, anon;
grant execute on function public.create_refund_obligation(uuid, text) to authenticated;

create or replace function public.cancel_order_and_refund(p_order_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
begin
  return public.create_refund_obligation(p_order_id, p_reason);
end;
$$;
revoke all on function public.cancel_order_and_refund(uuid, text) from public, anon;
grant execute on function public.cancel_order_and_refund(uuid, text) to authenticated;

create or replace function public.process_refund_obligation(p_refund_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare
  v_refund public.refund_obligations%rowtype;
  v_wallet public.wallets%rowtype;
  v_buyer_wallet public.buyer_wallets%rowtype;
  v_seller_tx uuid;
  v_buyer_tx uuid;
  v_is_admin boolean := false;
  v_is_service boolean := false;
begin
  v_is_service := coalesce(auth.role(), '') = 'service_role';
  if auth.uid() is null and not v_is_service then raise exception 'Please log in'; end if;
  select * into v_refund from public.refund_obligations where id = p_refund_id for update;
  if not found then raise exception 'Refund obligation not found'; end if;
  v_is_admin := public.is_platform_admin();
  if v_refund.seller_id <> auth.uid() and not v_is_admin and not v_is_service then raise exception 'Refund access denied'; end if;
  if v_refund.refund_status = 'refunded' then return jsonb_build_object('success', true, 'already_refunded', true, 'refund_id', v_refund.id, 'buyer_id', v_refund.buyer_id, 'seller_id', v_refund.seller_id, 'refund_due', v_refund.refund_due); end if;

  select * into v_wallet from public.wallets where store_id = v_refund.store_id for update;
  if v_wallet.id is null or coalesce(v_wallet.available, 0) < v_refund.refund_due then
    update public.refund_obligations set refund_status = 'pending_funding', outstanding_seller_contribution = greatest(0, round(v_refund.refund_due - coalesce(v_wallet.available, 0), 2)), updated_at = now(), last_failure_reason = 'Seller balance is insufficient.' where id = v_refund.id;
    return jsonb_build_object('success', false, 'insufficient_funds', true, 'refund_id', v_refund.id, 'refund_status', 'pending_funding', 'refund_due', v_refund.refund_due, 'available_funds', coalesce(v_wallet.available, 0), 'outstanding_seller_contribution', greatest(0, round(v_refund.refund_due - coalesce(v_wallet.available, 0), 2)), 'buyer_id', v_refund.buyer_id, 'seller_id', v_refund.seller_id);
  end if;

  update public.refund_obligations set refund_status = 'processing', processing_at = now(), updated_at = now(), last_failure_reason = null where id = v_refund.id;
  update public.wallets set available = round(coalesce(available, 0) - v_refund.refund_due, 2) where id = v_wallet.id and available >= v_refund.refund_due;
  if not found then
    update public.refund_obligations set refund_status = 'pending_funding', updated_at = now(), last_failure_reason = 'Seller balance changed before refund processing.' where id = v_refund.id;
    return jsonb_build_object('success', false, 'insufficient_funds', true, 'refund_id', v_refund.id, 'refund_status', 'pending_funding');
  end if;
  insert into public.wallet_transactions(wallet_id, order_id, refund_obligation_id, kind, amount, note, status)
  values(v_wallet.id, v_refund.order_id, v_refund.id, 'refund', -v_refund.refund_due, 'Full seller-funded refund · ' || v_refund.refund_reference, 'completed') returning id into v_seller_tx;
  insert into public.refund_ledger_entries(refund_obligation_id, entry_type, amount, idempotency_key, wallet_transaction_id, actor_id, details)
  values(v_refund.id, 'seller_refund_debit', v_refund.refund_due, 'seller-refund-debit:' || v_refund.id::text, v_seller_tx, auth.uid(), jsonb_build_object('seller_balance_debited', v_refund.refund_due, 'commission_retained', v_refund.original_commission));

  insert into public.buyer_wallets(user_id, balance) values(v_refund.buyer_id, 0) on conflict (user_id) do nothing;
  select * into v_buyer_wallet from public.buyer_wallets where user_id = v_refund.buyer_id for update;
  update public.buyer_wallets set balance = round(coalesce(balance, 0) + v_refund.refund_due, 2) where id = v_buyer_wallet.id;
  insert into public.buyer_wallet_transactions(buyer_wallet_id, order_id, refund_obligation_id, amount, label, provider_reference)
  values(v_buyer_wallet.id, v_refund.order_id, v_refund.id, v_refund.refund_due, 'Refund for cancelled order #' || (select order_code from public.orders where id = v_refund.order_id), v_refund.refund_reference) returning id into v_buyer_tx;
  insert into public.refund_ledger_entries(refund_obligation_id, entry_type, amount, idempotency_key, buyer_wallet_transaction_id, actor_id, details)
  values(v_refund.id, 'buyer_refund_credit', v_refund.refund_due, 'buyer-refund-credit:' || v_refund.id::text, v_buyer_tx, auth.uid(), jsonb_build_object('buyer_wallet_credited', v_refund.refund_due));
  update public.refund_obligations set refund_status = 'refunded', eligible_funds_used = v_refund.refund_due, outstanding_seller_contribution = 0, updated_at = now(), refunded_at = now(), last_failure_reason = null where id = v_refund.id;
  update public.orders set payment_status = 'refunded', escrow_status = 'refunded' where id = v_refund.order_id and payment_status = 'paid';
  insert into public.notifications(user_id, type, title, body, link) values(v_refund.buyer_id, 'wallet', 'Refund credited', 'Your refund of NGN ' || to_char(v_refund.refund_due, 'FM999,999,999,990.00') || ' has been credited to your Sella wallet.', '/account/orders/' || v_refund.order_id);
  insert into public.notifications(user_id, type, title, body, link) values(v_refund.seller_id, 'order', 'Refund completed', 'The full refund for order #' || (select order_code from public.orders where id = v_refund.order_id) || ' was funded from your seller balance.', '/dashboard/orders?order=' || v_refund.order_id);
  return jsonb_build_object('success', true, 'refunded', true, 'refund_id', v_refund.id, 'refund_reference', v_refund.refund_reference, 'refund_status', 'refunded', 'refund_due', v_refund.refund_due, 'buyer_id', v_refund.buyer_id, 'seller_id', v_refund.seller_id, 'seller_transaction_id', v_seller_tx, 'buyer_transaction_id', v_buyer_tx);
exception when unique_violation then
  if exists(select 1 from public.refund_obligations where id = p_refund_id and refund_status = 'refunded') then return jsonb_build_object('success', true, 'already_refunded', true, 'refund_id', p_refund_id); end if;
  raise;
end;
$$;
revoke all on function public.process_refund_obligation(uuid) from public, anon;
grant execute on function public.process_refund_obligation(uuid) to authenticated;

create or replace function public.get_seller_refund_obligations(p_store_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
begin
  if not exists(select 1 from public.stores where id = p_store_id and owner_id = auth.uid()) then raise exception 'Refund access denied'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('order_code',o.order_code,'buyer_name',coalesce(c.name,'Buyer'),'linked_withdrawal_status',w.status) order by r.created_at desc) from public.refund_obligations r join public.orders o on o.id=r.order_id left join public.customers c on c.id=o.customer_id left join public.withdrawals w on w.id=r.linked_withdrawal_id where r.store_id=p_store_id and r.refund_status <> 'refunded'), '[]'::jsonb);
end;
$$;
revoke all on function public.get_seller_refund_obligations(uuid) from public, anon;
grant execute on function public.get_seller_refund_obligations(uuid) to authenticated;

create or replace function public.get_buyer_refund_obligation(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_refund public.refund_obligations%rowtype;
begin
  select r.* into v_refund from public.refund_obligations r where r.order_id=p_order_id and r.buyer_id=auth.uid();
  if not found then return null; end if;
  return to_jsonb(v_refund) - 'seller_id' - 'funding_account_number' - 'funding_account_name' - 'funding_bank_name' - 'funding_account_reference' - 'funding_account_amount';
end;
$$;
revoke all on function public.get_buyer_refund_obligation(uuid) from public, anon;
grant execute on function public.get_buyer_refund_obligation(uuid) to authenticated;

alter table public.refund_obligations add column if not exists funding_account_amount numeric(12,2);

create or replace function public.get_refund_funding_request(p_refund_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_refund public.refund_obligations%rowtype; v_wallet public.wallets%rowtype; v_outstanding numeric(12,2);
begin
  select * into v_refund from public.refund_obligations where id=p_refund_id and seller_id=auth.uid() for update;
  if not found then raise exception 'Refund access denied'; end if;
  if v_refund.refund_status='refunded' then raise exception 'This refund is already complete'; end if;
  select * into v_wallet from public.wallets where store_id=v_refund.store_id for update;
  v_outstanding := greatest(0, round(v_refund.refund_due - coalesce(v_wallet.available,0), 2));
  update public.refund_obligations set outstanding_seller_contribution=v_outstanding, refund_status=case when v_outstanding>0 then 'pending_funding' else 'pending_review' end, updated_at=now() where id=v_refund.id;
  if v_outstanding <= 0 then raise exception 'Your available balance can cover this refund'; end if;
  if v_refund.funding_account_number is not null and v_refund.funding_account_expires_at > now() then
    return jsonb_build_object('refund_id',v_refund.id,'refund_reference',v_refund.refund_reference,'amount',v_refund.funding_account_amount,'account_number',v_refund.funding_account_number,'account_name',v_refund.funding_account_name,'bank_name',v_refund.funding_bank_name,'reference',v_refund.funding_account_reference,'expires_at',v_refund.funding_account_expires_at);
  end if;
  return jsonb_build_object('refund_id',v_refund.id,'refund_reference',v_refund.refund_reference,'amount',v_outstanding,'expires_at',null);
end;
$$;
revoke all on function public.get_refund_funding_request(uuid) from public, anon;
grant execute on function public.get_refund_funding_request(uuid) to authenticated;

drop function if exists public.set_refund_payment_account(uuid,text,text,text,text,timestamptz);
create or replace function public.set_refund_payment_account(p_refund_id uuid, p_account_number text, p_account_name text, p_bank_name text, p_payment_reference text, p_expires_at timestamptz, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_refund public.refund_obligations%rowtype;
begin
  select * into v_refund from public.refund_obligations where id=p_refund_id and seller_id=auth.uid() for update;
  if not found then raise exception 'Refund access denied'; end if;
  if v_refund.refund_status='refunded' then raise exception 'This refund is already complete'; end if;
  update public.refund_obligations set funding_account_number=nullif(trim(p_account_number),''), funding_account_name=nullif(trim(p_account_name),''), funding_bank_name=nullif(trim(p_bank_name),''), funding_account_reference=nullif(trim(p_payment_reference),''), funding_account_amount=round(p_amount,2), funding_account_expires_at=p_expires_at, updated_at=now() where id=p_refund_id;
  return jsonb_build_object('success',true,'refund_id',p_refund_id,'refund_reference',v_refund.refund_reference,'amount',v_refund.outstanding_seller_contribution,'account_number',p_account_number,'account_name',p_account_name,'bank_name',p_bank_name,'reference',p_payment_reference,'expires_at',p_expires_at);
end;
$$;
revoke all on function public.set_refund_payment_account(uuid,text,text,text,text,timestamptz,numeric) from public, anon;
grant execute on function public.set_refund_payment_account(uuid,text,text,text,text,timestamptz,numeric) to authenticated;

create or replace function public.record_refund_funding_payment(p_event_key text, p_payload jsonb, p_successful boolean, p_account_number text default null, p_account_reference text default null, p_amount numeric default 0, p_payment_reference text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_refund public.refund_obligations%rowtype; v_wallet public.wallets%rowtype; v_store public.stores%rowtype; v_payment_id uuid; v_shortfall numeric(12,2); v_auto_result jsonb;
begin
  if not coalesce(p_successful,false) or coalesce(p_amount,0)<=0 then return jsonb_build_object('handled',false); end if;
  select r.* into v_refund from public.refund_obligations r where (nullif(p_account_number,'') is not null and r.funding_account_number=p_account_number) or (nullif(p_account_reference,'') is not null and r.funding_account_reference=p_account_reference) order by r.created_at desc limit 1 for update;
  if not found then return jsonb_build_object('handled',false); end if;
  if v_refund.refund_status='refunded' then return jsonb_build_object('handled',true,'ignored',true,'reason','refund_already_complete','refund_id',v_refund.id); end if;
  if v_refund.funding_account_expires_at is not null and now()>v_refund.funding_account_expires_at then return jsonb_build_object('handled',true,'ignored',true,'reason','funding_account_expired','refund_id',v_refund.id); end if;
  if v_refund.funding_account_amount is not null and p_amount > v_refund.funding_account_amount then return jsonb_build_object('handled',true,'ignored',true,'reason','funding_amount_exceeds_requested_amount','refund_id',v_refund.id,'requested_amount',v_refund.funding_account_amount); end if;
  select * into v_wallet from public.wallets where store_id=v_refund.store_id for update;
  v_shortfall := greatest(0, round(v_refund.refund_due - coalesce(v_wallet.available,0), 2));
  if v_shortfall <= 0 then return jsonb_build_object('handled',true,'ignored',true,'reason','seller_balance_already_covers_refund','refund_id',v_refund.id); end if;
  if p_amount > v_shortfall then return jsonb_build_object('handled',true,'ignored',true,'reason','funding_amount_exceeds_shortfall','refund_id',v_refund.id,'required_amount',v_shortfall); end if;
  insert into public.refund_funding_payments(refund_obligation_id,provider_event_key,provider_reference,amount,status,payload,verified_at) values(v_refund.id,p_event_key,p_payment_reference,p_amount,'verified',coalesce(p_payload,'{}'::jsonb),now()) on conflict (provider_event_key) do nothing returning id into v_payment_id;
  if v_payment_id is null then return jsonb_build_object('handled',true,'duplicate',true,'refund_id',v_refund.id); end if;
  if v_wallet.id is null then insert into public.wallets(store_id,available,held) values(v_refund.store_id,p_amount,0) returning * into v_wallet; else update public.wallets set available=coalesce(available,0)+p_amount where id=v_wallet.id returning * into v_wallet; end if;
  insert into public.wallet_transactions(wallet_id,refund_obligation_id,kind,amount,note,status) values(v_wallet.id,v_refund.id,'credit',p_amount,'Verified refund funding · '||v_refund.refund_reference,'completed');
  insert into public.refund_ledger_entries(refund_obligation_id,entry_type,amount,idempotency_key,provider_reference,details) values(v_refund.id,'seller_funding',p_amount,'seller-funding:'||v_payment_id::text,p_payment_reference,jsonb_build_object('provider_event_key',p_event_key));
  select * into v_store from public.stores where id=v_refund.store_id;
  update public.refund_obligations set seller_funding_received=seller_funding_received+p_amount, outstanding_seller_contribution=greatest(0,round(refund_due-coalesce(v_wallet.available,0),2)), refund_status=case when coalesce(v_wallet.available,0)>=refund_due then 'pending_review' else 'pending_funding' end, updated_at=now(), last_failure_reason=null where id=v_refund.id;
  if coalesce(v_wallet.available,0) >= v_refund.refund_due then
    v_auto_result := public.process_refund_obligation(v_refund.id);
    return jsonb_build_object('handled',true,'credited','seller_refund_funding','refund_id',v_refund.id,'user_id',v_store.owner_id,'amount',p_amount,'refund_reference',v_refund.refund_reference,'auto_refunded',coalesce((v_auto_result->>'refunded')::boolean,false)) || v_auto_result;
  end if;
  insert into public.notifications(user_id,type,title,body,link) values(v_store.owner_id,'wallet','Refund funding received','Your verified refund funding payment was added to your Sella balance. You can now process the refund when the full amount is available.','/dashboard');
  return jsonb_build_object('handled',true,'credited','seller_refund_funding','refund_id',v_refund.id,'user_id',v_store.owner_id,'amount',p_amount,'refund_reference',v_refund.refund_reference);
end;
$$;
revoke all on function public.record_refund_funding_payment(text,jsonb,boolean,text,text,numeric,text) from public, anon, authenticated;
grant execute on function public.record_refund_funding_payment(text,jsonb,boolean,text,text,numeric,text) to service_role;

create or replace function public.record_refund_admin_action(p_refund_id uuid, p_action text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_refund public.refund_obligations%rowtype;
begin
  if not public.is_platform_admin() then raise exception 'Admin access required'; end if;
  select * into v_refund from public.refund_obligations where id=p_refund_id for update;
  if not found then raise exception 'Refund obligation not found'; end if;
  if p_action not in ('note','escalated') then raise exception 'Unsupported refund admin action'; end if;
  insert into public.refund_ledger_entries(refund_obligation_id,entry_type,amount,idempotency_key,actor_id,details) values(v_refund.id,case when p_action='note' then 'admin_note' else 'admin_escalation' end,0,'admin-action:'||p_action||':'||gen_random_uuid()::text,auth.uid(),jsonb_build_object('note',left(coalesce(p_note,''),2000)));
  insert into public.admin_audit_logs(admin_user_id,action,entity,entity_id,details) values(auth.uid(),'refund_'||p_action,'refund_obligation',v_refund.id,jsonb_build_object('note',left(coalesce(p_note,''),2000),'refund_reference',v_refund.refund_reference));
  return jsonb_build_object('success',true,'refund_id',v_refund.id,'action',p_action);
end;
$$;
revoke all on function public.record_refund_admin_action(uuid,text,text) from public, anon;
grant execute on function public.record_refund_admin_action(uuid,text,text) to authenticated;

create or replace function public.admin_refund_snapshot()
returns jsonb language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
begin
  if not public.is_platform_admin() then raise exception 'Admin access required'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('stores',jsonb_build_object('name',s.name),'available_seller_funds',coalesce(wallet.available,0),'buyer_name',coalesce(c.name,'Buyer'),'buyer_email',(select u.email from auth.users u where u.id=r.buyer_id),'linked_withdrawal_status',w.status,'last_activity',greatest(r.updated_at,coalesce((select max(e.created_at) from public.refund_ledger_entries e where e.refund_obligation_id=r.id),r.updated_at))) order by r.created_at desc)
    from public.refund_obligations r
    left join public.stores s on s.id=r.store_id
    left join public.wallets wallet on wallet.store_id=r.store_id
    left join public.customers c on c.id=(select o.customer_id from public.orders o where o.id=r.order_id)
    left join public.withdrawals w on w.id=r.linked_withdrawal_id), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_refund_snapshot() from public, anon;
grant execute on function public.admin_refund_snapshot() to authenticated;
notify pgrst,'reload schema';

-- Refund-funding accounts are checked before buyer accounts. The webhook only
-- credits a seller balance after the provider callback has been verified.
create or replace function public.process_transactpay_webhook(
  p_event_key text, p_payload jsonb, p_successful boolean,
  p_account_number text default null, p_account_reference text default null,
  p_amount numeric default 0, p_payment_reference text default null,
  p_order_reference text default null
)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare
  v_buyer_wallet public.buyer_wallets%rowtype;
  v_order public.orders%rowtype;
  v_store public.stores%rowtype;
  v_wallet public.wallets%rowtype;
  v_refund_result jsonb;
  v_net_amount numeric(12,2) := 0;
  v_commission_rate numeric := 3.2;
  v_commission numeric(12,2);
  v_net numeric(12,2);
  v_required numeric(12,2);
  v_event_id uuid;
begin
  if nullif(trim(p_event_key), '') is null then raise exception 'Webhook event key is required'; end if;
  v_refund_result := public.record_refund_funding_payment(p_event_key, p_payload, p_successful, p_account_number, p_account_reference, p_amount, p_payment_reference);
  if coalesce((v_refund_result->>'handled')::boolean, false) then return v_refund_result; end if;
  insert into public.payment_webhook_events(provider, event_key, payload)
    values ('transactpay', p_event_key, coalesce(p_payload, '{}'::jsonb))
    on conflict (event_key) do nothing returning id into v_event_id;
  if v_event_id is null then return jsonb_build_object('received', true, 'duplicate', true); end if;
  if not coalesce(p_successful, false) then return jsonb_build_object('received', true, 'ignored', true); end if;
  if coalesce(p_amount, 0) <= 0 then return jsonb_build_object('received', true, 'ignored', true, 'reason', 'amount_missing'); end if;
  select * into v_buyer_wallet from public.buyer_wallets where (nullif(p_account_number, '') is not null and dedicated_account_number = p_account_number) or (nullif(p_account_reference, '') is not null and dedicated_account_reference = p_account_reference) order by created_at asc limit 1 for update;
  if v_buyer_wallet.id is not null then
    v_net_amount := round(p_amount, 2);
    update public.buyer_wallets set balance = coalesce(v_buyer_wallet.balance, 0) + v_net_amount where id = v_buyer_wallet.id;
    insert into public.buyer_wallet_transactions(buyer_wallet_id, amount, label, provider_reference) values (v_buyer_wallet.id, v_net_amount, 'Wallet deposit', p_payment_reference);
    insert into public.notifications(user_id, type, title, body, link) values (v_buyer_wallet.user_id, 'wallet', 'Wallet funded', 'Your Sella wallet received NGN ' || to_char(v_net_amount, 'FM999,999,999,990.00') || '.', '/account/wallet');
    return jsonb_build_object('received', true, 'credited', 'buyer_wallet', 'wallet_id', v_buyer_wallet.id, 'user_id', v_buyer_wallet.user_id, 'amount', v_net_amount, 'gross_amount', p_amount);
  end if;
  if nullif(p_order_reference, '') is not null and p_order_reference ~* '^[0-9a-f]{8}-[0-9a-f-]{27}$' then select * into v_order from public.orders where id = p_order_reference::uuid limit 1 for update; else select * into v_order from public.orders where payment_reference = coalesce(nullif(p_order_reference, ''), p_payment_reference) or payment_reference = p_payment_reference order by created_at desc limit 1 for update; end if;
  if v_order.id is null or v_order.payment_status = 'paid' then return jsonb_build_object('received', true, 'ignored', true, 'reason', 'order_not_found_or_paid'); end if;
  v_required := greatest(coalesce(nullif(v_order.payment_total, 0), v_order.total), v_order.total);
  if p_amount < v_required then return jsonb_build_object('received', true, 'ignored', true, 'reason', 'amount_mismatch', 'required_amount', v_required, 'received_amount', p_amount); end if;
  select * into v_store from public.stores where id = v_order.store_id limit 1;
  v_commission_rate := public.seller_commission_rate(v_order.store_id);
  v_commission := round(v_order.total * v_commission_rate / 100, 2);
  v_net := greatest(0, round(v_order.total - v_commission, 2));
  select * into v_wallet from public.wallets where store_id = v_order.store_id limit 1 for update;
  if v_wallet.id is null then insert into public.wallets(store_id, available, held) values (v_order.store_id, v_net, 0) returning * into v_wallet; else update public.wallets set available = coalesce(v_wallet.available, 0) + v_net, held = 0 where id = v_wallet.id returning * into v_wallet; end if;
  insert into public.wallet_transactions(wallet_id, order_id, kind, amount, note) values (v_wallet.id, v_order.id, 'credit', v_net, 'Order payment · #' || v_order.order_code);
  update public.orders set payment_status = 'paid', paid_at = now(), payment_expires_at = null, escrow_status = 'released', commission = v_commission, net_to_seller = v_net, payment_reference = coalesce(p_payment_reference, payment_reference) where id = v_order.id;
  insert into public.notifications(user_id, type, title, body, link) values (v_order.buyer_id, 'order', 'Payment confirmed', 'Payment for order #' || v_order.order_code || ' has been confirmed.', '/account/orders/' || v_order.id);
  insert into public.notifications(user_id, type, title, body, link) values (v_store.owner_id, 'order', 'Payment received', 'Payment for order #' || v_order.order_code || ' has been confirmed.', '/dashboard/orders?order=' || v_order.id);
  return jsonb_build_object('received', true, 'credited', 'seller_wallet', 'order_id', v_order.id, 'user_id', v_store.owner_id, 'amount', v_net, 'gross_amount', p_amount, 'commission', v_commission, 'commission_rate', v_commission_rate, 'required_amount', v_required);
end;
$$;
revoke all on function public.process_transactpay_webhook(text,jsonb,boolean,text,text,numeric,text,text) from public, anon, authenticated;
grant execute on function public.process_transactpay_webhook(text,jsonb,boolean,text,text,numeric,text,text) to service_role;
notify pgrst, 'reload schema';
