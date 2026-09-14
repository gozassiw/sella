-- Sella Stage 60: compulsory seller passport photograph for verification.
alter table public.stores
  add column if not exists passport_photo_url text;

create or replace function public.require_seller_verification_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.approval_status = 'approved'
     and coalesce(old.approval_status, '') <> 'approved'
     and nullif(trim(new.passport_photo_url), '') is null then
    raise exception 'A passport photograph is required before approving this seller.';
  end if;
  return new;
end;
$$;

drop trigger if exists stores_require_passport_photo on public.stores;
create trigger stores_require_passport_photo
before update on public.stores
for each row execute function public.require_seller_verification_photo();
