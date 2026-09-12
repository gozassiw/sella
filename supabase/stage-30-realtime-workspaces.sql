-- Sella Stage 30: realtime workspace synchronization.
-- Supabase Realtime pushes row changes to the open buyer, seller, and admin workspace.

alter table if exists public.buyer_wallets replica identity full;
alter table if exists public.buyer_wallet_transactions replica identity full;
alter table if exists public.orders replica identity full;
alter table if exists public.products replica identity full;
alter table if exists public.wallets replica identity full;
alter table if exists public.notifications replica identity full;
alter table if exists public.stores replica identity full;
alter table if exists public.subscriptions replica identity full;
alter table if exists public.withdrawals replica identity full;
alter table if exists public.reports replica identity full;
alter table if exists public.payment_webhook_events replica identity full;
alter table if exists public.account_holds replica identity full;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'buyer_wallets', 'buyer_wallet_transactions', 'orders', 'products', 'wallets',
    'notifications', 'stores', 'subscriptions', 'withdrawals', 'reports',
    'payment_webhook_events', 'account_holds'
  ] loop
    if to_regclass('public.' || table_name) is not null
       and not exists (
         select 1
         from pg_publication_rel pr
         join pg_publication p on p.oid = pr.prpubid
         where p.pubname = 'supabase_realtime'
           and pr.prrelid = to_regclass('public.' || table_name)
       ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
