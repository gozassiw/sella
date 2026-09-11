-- =====================================================================
-- Sella: schema additions (Part 2)
-- Run schema.sql from the Stage 1 zip FIRST — this builds on its tables
-- and reuses its owns_store() function and store-media storage bucket.
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- =====================================================================

-- ---------- Seller wallets (one per store) ----------
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  available numeric(12,2) not null default 0,   -- withdrawable now
  held numeric(12,2) not null default 0,          -- waiting on delivery confirmation
  created_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  kind text not null check (kind in ('hold','release','withdrawal','refund','credit','plan_payment')),
  amount numeric(12,2) not null,
  note text,
  status text not null default 'completed' check (status in ('completed','processing')),
  created_at timestamptz not null default now()
);
create index if not exists wallet_txns_wallet_idx on public.wallet_transactions(wallet_id, created_at desc);

-- ---------- Buyer wallets (one per person, works across every store) ----------
create table if not exists public.buyer_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  balance numeric(12,2) not null default 0,
  dedicated_account_number text,   -- filled in once TransactPay issues it
  created_at timestamptz not null default now()
);

create table if not exists public.buyer_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  buyer_wallet_id uuid not null references public.buyer_wallets(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  amount numeric(12,2) not null,   -- negative for payments, positive for top-ups/refunds
  label text not null,
  created_at timestamptz not null default now()
);

-- ---------- Subscriptions ----------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  plan text not null check (plan in ('quarterly','biannual','yearly')),
  amount numeric(12,2) not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  paid_with text not null check (paid_with in ('wallet','transfer'))
);

-- ---------- Extra fields on stores: verification & trust ----------
alter table public.stores
  add column if not exists legal_name text,
  add column if not exists nin text,
  add column if not exists nin_status text not null default 'none' check (nin_status in ('none','pending','verified')),
  add column if not exists cac_number text,
  add column if not exists cac_file_url text,
  add column if not exists verification_approved boolean not null default false,
  add column if not exists trusted boolean not null default false,
  add column if not exists completed_orders integer not null default 0,
  add column if not exists delivery_note text;

-- ---------- Extra fields on orders: escrow & fulfilment ----------
alter table public.orders
  add column if not exists fulfilment_method text not null default 'delivery' check (fulfilment_method in ('pickup','delivery')),
  add column if not exists delivery_code text,
  add column if not exists escrow_status text not null default 'held' check (escrow_status in ('held','released','refunded')),
  add column if not exists reported_reason text,
  add column if not exists commission numeric(12,2) not null default 0,
  add column if not exists net_to_seller numeric(12,2) not null default 0;

-- ---------- Reports (order reports & store reports) ----------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('order','store')),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  reported_by uuid references auth.users(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now()
);
create index if not exists reports_store_idx on public.reports(store_id, created_at desc);

-- =====================================================================
-- Security
-- =====================================================================
-- IMPORTANT: wallets, wallet_transactions, buyer_wallets, and
-- buyer_wallet_transactions are deliberately NOT writable by sellers or
-- buyers directly, even though they can read their own. Anything that
-- moves money — crediting a wallet after payment, releasing escrow,
-- approving a withdrawal — must be written by trusted server code (a
-- Supabase Edge Function or a Next.js server action) using the Supabase
-- **service role key**, never the public anon key from the browser.
-- When you brief Manus, tell it explicitly: payment confirmation,
-- escrow release, and withdrawal payouts happen in a server-side
-- function triggered by a verified TransactPay webhook — not from a
-- button in the browser calling the database directly. Otherwise a
-- seller or buyer could fake themselves free money.

alter table public.wallets                    enable row level security;
alter table public.wallet_transactions         enable row level security;
alter table public.buyer_wallets               enable row level security;
alter table public.buyer_wallet_transactions   enable row level security;
alter table public.subscriptions               enable row level security;
alter table public.reports                     enable row level security;

create policy "wallets: owner read" on public.wallets
  for select using (public.owns_store(store_id));

create policy "wallet_transactions: owner read" on public.wallet_transactions
  for select using (exists (select 1 from public.wallets w where w.id = wallet_id and public.owns_store(w.store_id)));

create policy "buyer_wallets: owner read" on public.buyer_wallets
  for select using (user_id = auth.uid());

create policy "buyer_wallet_transactions: owner read" on public.buyer_wallet_transactions
  for select using (exists (select 1 from public.buyer_wallets b where b.id = buyer_wallet_id and b.user_id = auth.uid()));

create policy "subscriptions: owner read" on public.subscriptions
  for select using (public.owns_store(store_id));

-- Reports: a buyer can file one (insert) and read their own; a seller can
-- read reports about their own store. Resolving a report is an admin
-- action and should go through the service role, not a client policy.
create policy "reports: reporter insert" on public.reports
  for insert with check (reported_by = auth.uid());
create policy "reports: reporter read own" on public.reports
  for select using (reported_by = auth.uid());
create policy "reports: seller read own store" on public.reports
  for select using (public.owns_store(store_id));

-- ---------- CAC certificate uploads ----------
-- No new storage bucket needed — the store-media bucket and policies from
-- schema.sql already let a seller upload anywhere under their own folder,
-- e.g. {their_user_id}/verification/cac-certificate.pdf
