-- Sella Stage 69: seller-safe readers for billing and verification state.

create or replace function public.get_paid_verification_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'amount', coalesce((value->>'amount')::numeric, 0)
  )
  from public.app_settings
  where key = 'paid_verification_fee'
  limit 1;
$$;
revoke all on function public.get_paid_verification_settings() from public, anon;
grant execute on function public.get_paid_verification_settings() to authenticated;

notify pgrst, 'reload schema';
