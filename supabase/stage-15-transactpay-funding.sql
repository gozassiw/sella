-- Sella Stage 15: atomic TransactPay funding processing.
-- The webhook endpoint is public, so all wallet/order writes happen inside
-- this security-definer function rather than through a browser or anon table write.

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
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_wallet public.buyer_wallets%rowtype;
  v_order public.orders%rowtype;
  v_store public.stores%rowtype;
  v_wallet public.wallets%rowtype;
  v_commission_setting jsonb;
  v_threshold_setting jsonb;
  v_commission_rate numeric := 5;
  v_threshold integer := 3;
  v_commission numeric;
  v_net numeric;
  v_trusted boolean;
  v_event_id uuid;
begin
  if nullif(trim(p_event_key), '') is null then
    raise exception 'Webhook event key is required';
  end if;

  insert into public.payment_webhook_events(provider, event_key, payload)
  values ('transactpay', p_event_key, coalesce(p_payload, '{}'::jsonb))
  on conflict (event_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return jsonb_build_object('received', true, 'duplicate', true);
  end if;

  if not coalesce(p_successful, false) then
    return jsonb_build_object('received', true, 'ignored', true);
  end if;

  if coalesce(p_amount, 0) <= 0 then
    return jsonb_build_object('received', true, 'ignored', true, 'reason', 'amount_missing');
  end if;

  select * into v_buyer_wallet
  from public.buyer_wallets
  where (nullif(p_account_number, '') is not null and dedicated_account_number = p_account_number)
     or (nullif(p_account_reference, '') is not null and dedicated_account_reference = p_account_reference)
  order by created_at asc
  limit 1
  for update;

  if v_buyer_wallet.id is not null then
    update public.buyer_wallets
    set balance = coalesce(v_buyer_wallet.balance, 0) + p_amount
    where id = v_buyer_wallet.id;

    insert into public.buyer_wallet_transactions(buyer_wallet_id, amount, label, provider_reference)
    values (v_buyer_wallet.id, p_amount, 'TransactPay wallet funding', p_payment_reference);

    return jsonb_build_object('received', true, 'credited', 'buyer_wallet', 'wallet_id', v_buyer_wallet.id, 'amount', p_amount);
  end if;

  if nullif(p_order_reference, '') is not null and p_order_reference ~* '^[0-9a-f]{8}-[0-9a-f-]{27}$' then
    select * into v_order from public.orders where id = p_order_reference::uuid limit 1 for update;
  else
    select * into v_order from public.orders
    where payment_reference = coalesce(nullif(p_order_reference, ''), p_payment_reference)
       or payment_reference = p_payment_reference
    order by created_at desc
    limit 1
    for update;
  end if;

  if v_order.id is null or v_order.payment_status = 'paid' then
    return jsonb_build_object('received', true, 'ignored', true, 'reason', 'order_not_found_or_paid');
  end if;

  select * into v_store from public.stores where id = v_order.store_id limit 1;
  select value into v_commission_setting from public.app_settings where key = 'commission_rate' limit 1;
  select value into v_threshold_setting from public.app_settings where key = 'trusted_order_threshold' limit 1;
  v_commission_rate := least(100, greatest(0, coalesce((v_commission_setting->>'rate')::numeric, 5)));
  v_threshold := greatest(1, coalesce((v_threshold_setting->>'count')::integer, 3));
  v_commission := round(p_amount * v_commission_rate / 100, 2);
  v_net := p_amount - v_commission;
  v_trusted := coalesce(v_store.trusted, false) or coalesce(v_store.completed_orders, 0) >= v_threshold;

  select * into v_wallet from public.wallets where store_id = v_order.store_id limit 1 for update;
  if v_wallet.id is null then
    insert into public.wallets(store_id, available, held)
    values (v_order.store_id, case when v_trusted then v_net else 0 end, case when v_trusted then 0 else v_net end)
    returning * into v_wallet;
  else
    update public.wallets
    set available = coalesce(v_wallet.available, 0) + case when v_trusted then v_net else 0 end,
        held = coalesce(v_wallet.held, 0) + case when v_trusted then 0 else v_net end
    where id = v_wallet.id
    returning * into v_wallet;
  end if;

  insert into public.wallet_transactions(wallet_id, order_id, kind, amount, note)
  values (v_wallet.id, v_order.id, case when v_trusted then 'credit' else 'hold' end, v_net, 'TransactPay payment');

  update public.orders
  set payment_status = 'paid', paid_at = now(), escrow_status = case when v_trusted then 'released' else 'held' end,
      commission = v_commission, net_to_seller = v_net, payment_reference = coalesce(p_payment_reference, payment_reference)
  where id = v_order.id;

  return jsonb_build_object('received', true, 'credited', 'seller_wallet', 'order_id', v_order.id, 'amount', p_amount);
end;
$$;

grant execute on function public.process_transactpay_webhook(text, jsonb, boolean, text, text, numeric, text, text) to anon, authenticated;
