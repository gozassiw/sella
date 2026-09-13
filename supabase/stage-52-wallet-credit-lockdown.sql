-- Sella Stage 52: wallet-credit security lockdown.
-- Browser/public Supabase keys must never be able to invoke money-moving RPCs.
-- The webhook route now uses the server-only Supabase service-role client and
-- verifies successful provider events before calling these functions.

revoke execute on function public.process_transactpay_webhook(text, jsonb, boolean, text, text, numeric, text, text) from public, anon, authenticated;
revoke execute on function public.process_transactpay_subscription(text, jsonb, boolean, numeric, text, text) from public, anon, authenticated;

grant execute on function public.process_transactpay_webhook(text, jsonb, boolean, text, text, numeric, text, text) to service_role;
grant execute on function public.process_transactpay_subscription(text, jsonb, boolean, numeric, text, text) to service_role;

grant usage on schema public to service_role;

-- Prevent direct browser writes even if a future policy or grant is added by mistake.
revoke insert, update, delete on table public.buyer_wallets from public, anon, authenticated;
revoke insert, update, delete on table public.buyer_wallet_transactions from public, anon, authenticated;
revoke insert, update, delete on table public.wallets from public, anon, authenticated;
revoke insert, update, delete on table public.wallet_transactions from public, anon, authenticated;
revoke insert, update, delete on table public.payment_webhook_events from public, anon, authenticated;

notify pgrst, 'reload schema';
