-- Sella Stage 13: make admin finance settings effective in wallet payments.
create or replace function public.pay_order_from_wallet(p_order_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_wallet public.buyer_wallets%rowtype;
  v_store public.stores%rowtype;
  v_commission numeric(12,2);
  v_net numeric(12,2);
  v_is_trusted boolean;
  v_commission_rate numeric := 5;
  v_trust_threshold integer := 3;
  v_setting jsonb;
begin
  select * into v_order from public.orders where id = p_order_id and buyer_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.payment_status <> 'unpaid' then raise exception 'Order is already paid'; end if;
  select * into v_wallet from public.buyer_wallets where user_id = auth.uid() for update;
  if not found or v_wallet.balance < v_order.total then raise exception 'Insufficient wallet balance'; end if;
  select * into v_store from public.stores where id = v_order.store_id;
  select value into v_setting from public.app_settings where key = 'commission_rate';
  v_commission_rate := least(100, greatest(0, coalesce((v_setting->>'rate')::numeric, 5)));
  select value into v_setting from public.app_settings where key = 'trusted_order_threshold';
  v_trust_threshold := greatest(1, coalesce((v_setting->>'count')::integer, 3));
  v_is_trusted := coalesce(v_store.trusted, false) or coalesce(v_store.completed_orders, 0) >= v_trust_threshold;
  v_commission := round(v_order.total * v_commission_rate / 100, 2);
  v_net := v_order.total - v_commission;
  update public.buyer_wallets set balance = balance - v_order.total where id = v_wallet.id;
  insert into public.buyer_wallet_transactions(buyer_wallet_id, order_id, amount, label) values (v_wallet.id, v_order.id, -v_order.total, 'Payment for order #' || v_order.order_number);
  insert into public.wallets(store_id, available, held) values (v_order.store_id, case when v_is_trusted then v_net else 0 end, case when v_is_trusted then 0 else v_net end)
    on conflict (store_id) do update set held = wallets.held + excluded.held, available = wallets.available + excluded.available;
  insert into public.wallet_transactions(wallet_id, order_id, kind, amount, note) select id, v_order.id, case when v_is_trusted then 'credit' else 'hold' end, v_net, 'Wallet payment for order #' || v_order.order_number from public.wallets where store_id = v_order.store_id;
  update public.orders set payment_status = 'paid', paid_at = now(), escrow_status = case when v_is_trusted then 'released' else 'held' end, commission = v_commission, net_to_seller = v_net, payment_reference = 'wallet-' || v_order.id::text where id = v_order.id;
  return jsonb_build_object('success', true, 'order_id', v_order.id);
end; $$;
grant execute on function public.pay_order_from_wallet(uuid) to authenticated;
