-- Sella Stage 29: reusable buyer checkout details and wallet activity access.

alter table public.buyer_profiles
  add column if not exists call_number text,
  add column if not exists delivery_address text;

grant select on public.buyer_wallets, public.buyer_wallet_transactions to authenticated;
notify pgrst, 'reload schema';
