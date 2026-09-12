-- Sella Stage 32: reliable in-app notification events and wallet notification records.
-- Dashboard notifications are inserted through SECURITY DEFINER functions so they do not depend on a server service-role key.

create or replace function public.notify_order_participants(
  p_order_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_buyer_link text default '/account/orders',
  p_seller_link text default '/dashboard/orders'
)
returns integer language plpgsql security definer set search_path = public, auth as $$
declare
  v_order public.orders%rowtype;
  v_owner_id uuid;
  v_count integer := 0;
begin
  select o.* into v_order from public.orders o where o.id = p_order_id;
  if not found then raise exception 'Order not found'; end if;
  select owner_id into v_owner_id from public.stores where id = v_order.store_id;
  if auth.uid() is distinct from v_order.buyer_id and auth.uid() is distinct from v_owner_id and not public.is_platform_admin() then raise exception 'Notification access denied'; end if;
  if v_order.buyer_id is not null then
    insert into public.notifications(user_id, type, title, body, link) values (v_order.buyer_id, coalesce(nullif(p_type, ''), 'order'), p_title, p_body, p_buyer_link);
    v_count := v_count + 1;
  end if;
  if v_owner_id is not null and v_owner_id is distinct from v_order.buyer_id then
    insert into public.notifications(user_id, type, title, body, link) values (v_owner_id, coalesce(nullif(p_type, ''), 'order'), p_title, p_body, p_seller_link);
    v_count := v_count + 1;
  end if;
  return v_count;
end;
$$;
grant execute on function public.notify_order_participants(uuid, text, text, text, text, text) to authenticated;

create or replace function public.notify_withdrawal_owner(p_withdrawal_id uuid, p_status text)
returns integer language plpgsql security definer set search_path = public, auth as $$
declare
  v_owner_id uuid;
  v_amount numeric;
  v_sent boolean := p_status = 'sent';
begin
  if not public.is_platform_admin() then raise exception 'Admin access required'; end if;
  select s.owner_id, w.amount into v_owner_id, v_amount from public.withdrawals w join public.stores s on s.id = w.store_id where w.id = p_withdrawal_id;
  if v_owner_id is null then raise exception 'Withdrawal not found'; end if;
  insert into public.notifications(user_id, type, title, body, link)
    values (v_owner_id, 'withdrawal', case when v_sent then 'Withdrawal processed' else 'Withdrawal rejected' end,
      case when v_sent then 'Your NGN ' || to_char(v_amount, 'FM999,999,999,990.00') || ' withdrawal has been processed.' else 'Your withdrawal request was rejected by Sella Team. Check your seller wallet for details.' end,
      '/dashboard/wallet');
  return 1;
end;
$$;
grant execute on function public.notify_withdrawal_owner(uuid, text) to authenticated;

create or replace function public.process_transactpay_webhook(
  p_event_key text,
  p_payload jsonb,
  p_successful boolean,
  p_account_number text default null,
  p_account_reference text default null,
  p_amount numeric default 0,
  p_payment_reference text default null,
  p_order_reference text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_buyer_wallet public.buyer_wallets%rowtype;
  v_order public.orders%rowtype;
  v_store public.stores%rowtype;
  v_wallet public.wallets%rowtype;
  v_commission_setting jsonb;
  v_threshold_setting jsonb;
  v_commission_rate numeric := 5;
  v_threshold integer := 3;
  v_provider_fee numeric := 0;
  v_net_amount numeric := 0;
  v_commission numeric;
  v_net numeric;
  v_trusted boolean;
  v_event_id uuid;
begin
  if nullif(trim(p_event_key), '') is null then raise exception 'Webhook event key is required'; end if;
  insert into public.payment_webhook_events(provider, event_key, payload) values ('transactpay', p_event_key, coalesce(p_payload, '{}'::jsonb)) on conflict (event_key) do nothing returning id into v_event_id;
  if v_event_id is null then return jsonb_build_object('received', true, 'duplicate', true); end if;
  if not coalesce(p_successful, false) then return jsonb_build_object('received', true, 'ignored', true); end if;
  if coalesce(p_amount, 0) <= 0 then return jsonb_build_object('received', true, 'ignored', true, 'reason', 'amount_missing'); end if;

  select * into v_buyer_wallet from public.buyer_wallets where (nullif(p_account_number, '') is not null and dedicated_account_number = p_account_number) or (nullif(p_account_reference, '') is not null and dedicated_account_reference = p_account_reference) order by created_at asc limit 1 for update;
  if v_buyer_wallet.id is not null then
    v_provider_fee := least(round(p_amount * 1.5 / 100, 2), 2000);
    v_net_amount := greatest(0, round(p_amount - v_provider_fee, 2));
    update public.buyer_wallets set balance = coalesce(v_buyer_wallet.balance, 0) + v_net_amount where id = v_buyer_wallet.id;
    insert into public.buyer_wallet_transactions(buyer_wallet_id, amount, label, provider_reference) values (v_buyer_wallet.id, v_net_amount, 'TransactPay wallet funding (1.5% fee deducted, capped at NGN 2,000)', p_payment_reference);
    insert into public.notifications(user_id, type, title, body, link) values (v_buyer_wallet.user_id, 'wallet', 'Wallet funded', 'Your Sella wallet received NGN ' || to_char(v_net_amount, 'FM999,999,999,990.00') || '.', '/account/wallet');
    return jsonb_build_object('received', true, 'credited', 'buyer_wallet', 'wallet_id', v_buyer_wallet.id, 'user_id', v_buyer_wallet.user_id, 'amount', v_net_amount, 'gross_amount', p_amount, 'provider_fee', v_provider_fee);
  end if;

  if nullif(p_order_reference, '') is not null and p_order_reference ~* '^[0-9a-f]{8}-[0-9a-f-]{27}$' then select * into v_order from public.orders where id = p_order_reference::uuid limit 1 for update;
  else select * into v_order from public.orders where payment_reference = coalesce(nullif(p_order_reference, ''), p_payment_reference) or payment_reference = p_payment_reference order by created_at desc limit 1 for update;
  end if;
  if v_order.id is null or v_order.payment_status = 'paid' then return jsonb_build_object('received', true, 'ignored', true, 'reason', 'order_not_found_or_paid'); end if;

  select * into v_store from public.stores where id = v_order.store_id limit 1;
  select value into v_commission_setting from public.app_settings where key = 'commission_rate' limit 1;
  select value into v_threshold_setting from public.app_settings where key = 'trusted_order_threshold' limit 1;
  v_commission_rate := least(100, greatest(0, coalesce((v_commission_setting->>'rate')::numeric, 5)));
  v_threshold := greatest(1, coalesce((v_threshold_setting->>'count')::integer, 3));
  v_provider_fee := least(round(p_amount * 1.5 / 100, 2), 2000);
  v_commission := round(p_amount * v_commission_rate / 100, 2);
  v_net := greatest(0, round(p_amount - v_provider_fee - v_commission, 2));
  v_trusted := coalesce(v_store.trusted, false) or coalesce(v_store.completed_orders, 0) >= v_threshold;
  select * into v_wallet from public.wallets where store_id = v_order.store_id limit 1 for update;
  if v_wallet.id is null then insert into public.wallets(store_id, available, held) values (v_order.store_id, case when v_trusted then v_net else 0 end, case when v_trusted then 0 else v_net end) returning * into v_wallet;
  else update public.wallets set available = coalesce(v_wallet.available, 0) + case when v_trusted then v_net else 0 end, held = coalesce(v_wallet.held, 0) + case when v_trusted then 0 else v_net end where id = v_wallet.id returning * into v_wallet;
  end if;
  insert into public.wallet_transactions(wallet_id, order_id, kind, amount, note) values (v_wallet.id, v_order.id, case when v_trusted then 'credit' else 'hold' end, v_net, 'TransactPay payment (1.5% provider fee deducted, capped at NGN 2,000)');
  update public.orders set payment_status = 'paid', paid_at = now(), escrow_status = case when v_trusted then 'released' else 'held' end, commission = v_commission, net_to_seller = v_net, payment_reference = coalesce(p_payment_reference, payment_reference) where id = v_order.id;
  insert into public.notifications(user_id, type, title, body, link) values (v_order.buyer_id, 'order', 'Payment confirmed', 'Payment for order #' || v_order.order_code || ' has been confirmed.', '/account/orders/' || v_order.id);
  insert into public.notifications(user_id, type, title, body, link) values (v_store.owner_id, 'order', 'Payment received', 'Payment for order #' || v_order.order_code || ' has been confirmed.', '/dashboard/orders?order=' || v_order.id);
  return jsonb_build_object('received', true, 'credited', 'seller_wallet', 'order_id', v_order.id, 'user_id', v_store.owner_id, 'amount', v_net, 'gross_amount', p_amount, 'provider_fee', v_provider_fee, 'commission', v_commission);
end;
$$;
grant execute on function public.process_transactpay_webhook(text, jsonb, boolean, text, text, numeric, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
