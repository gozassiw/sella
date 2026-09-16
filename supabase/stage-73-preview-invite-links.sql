-- Sella Stage 73: expiring Admin-generated tester invite links.
create table if not exists public.launch_preview_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists launch_preview_tokens_expiry_idx on public.launch_preview_tokens(expires_at desc);
create index if not exists launch_preview_tokens_creator_idx on public.launch_preview_tokens(created_by, created_at desc);
alter table public.launch_preview_tokens enable row level security;
revoke all on public.launch_preview_tokens from anon, authenticated;
alter table public.launch_preview_tokens owner to postgres;
notify pgrst, 'reload schema';
