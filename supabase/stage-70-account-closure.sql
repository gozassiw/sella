-- Sella Stage 70: transparent self-service account closure.
-- Personal/profile access is removed and the auth identity is permanently banned
-- by the server route. Financial, order, fraud, legal, and audit records remain
-- minimally retained for reconciliation and legal obligations.

create table if not exists public.account_closures (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('buyer', 'seller', 'both')),
  closed_at timestamptz not null default now(),
  closure_reason text not null,
  retention_note text not null default 'Limited order, payment, fraud, legal, and audit records retained for reconciliation and legal obligations.'
);

alter table public.account_closures enable row level security;
drop policy if exists account_closures_owner_read on public.account_closures;
create policy account_closures_owner_read on public.account_closures
for select to authenticated using (user_id = auth.uid());

drop function if exists public.close_my_account();
create or replace function public.close_my_account(p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_store public.stores%rowtype;
  v_role text := 'buyer';
  v_wallet_balance numeric := 0;
  v_open_orders integer := 0;
  v_now timestamptz := now();
begin
  if v_user_id is null then raise exception 'You must be signed in to close your account.'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Please choose a reason before closing your account.'; end if;
  if exists (select 1 from public.account_closures where user_id = v_user_id) then
    return jsonb_build_object('closed', true, 'already_closed', true);
  end if;

  select * into v_store from public.stores where owner_id = v_user_id limit 1;
  if found then v_role := 'seller'; end if;

  select coalesce(balance, 0) into v_wallet_balance from public.buyer_wallets where user_id = v_user_id limit 1;
  if v_wallet_balance > 0 then
    raise exception 'Withdraw or spend your remaining wallet balance before closing this account.';
  end if;

  select count(*) into v_open_orders
  from public.orders
  where buyer_id = v_user_id and status not in ('delivered', 'cancelled');
  if v_open_orders > 0 then
    raise exception 'Complete or cancel your open orders before closing this account.';
  end if;

  insert into public.account_closures(user_id, role, closed_at)
  values (v_user_id, v_role, v_now, trim(p_reason));

  -- Remove personal buyer profile, follows, notifications, consent copy,
  -- subscriptions, and chat media/message content owned by this account.
  delete from public.buyer_profiles where user_id = v_user_id;
  delete from public.buyer_store_follows where user_id = v_user_id;
  delete from public.push_subscriptions where user_id = v_user_id;
  delete from public.notifications where user_id = v_user_id;
  delete from public.account_consents where user_id = v_user_id;
  delete from public.chat_messages where sender_id = v_user_id;
  delete from public.chat_conversations where buyer_id = v_user_id;
  delete from public.chat_conversations c
  using public.stores s
  where c.store_id = s.id and s.owner_id = v_user_id;

  -- Keep order/payment records, but remove copied contact details from the
  -- customer records linked to the closed buyer's historical orders.
  update public.customers c
  set name = 'Closed account', phone = null, email = null, address = null, whatsapp = null
  where exists (select 1 from public.orders o where o.customer_id = c.id and o.buyer_id = v_user_id);

  if found then
    -- no-op: keeps the function's result deterministic after the anonymisation update
    null;
  end if;

  if v_store.id is not null then
    update public.stores
    set is_published = false,
        seller_code_active = false,
        order_access_suspended = true,
        paid_verification_approved = false,
        paid_verification_approved_at = null,
        verification_approved = false,
        nin_status = 'pending',
        legal_name = null,
        nin = null,
        cac_number = null,
        cac_file_url = null,
        passport_photo_url = null,
        phone = null,
        whatsapp = null,
        address = null,
        description = null,
        logo_url = null,
        rejection_reason = 'Account closed by account owner.',
        verification_notes = null
    where id = v_store.id;
  end if;

  return jsonb_build_object('closed', true, 'role', v_role, 'reason', trim(p_reason), 'closed_at', v_now);
end;
$$;

revoke all on function public.close_my_account() from public;
grant execute on function public.close_my_account() to authenticated;
notify pgrst, 'reload schema';
