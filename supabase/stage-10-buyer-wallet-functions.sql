-- Sella Stage 10: buyer wallet generation without service-role dependency.
create or replace function public.get_or_create_buyer_wallet() returns public.buyer_wallets language plpgsql security definer set search_path = public as $$
declare v_wallet public.buyer_wallets;
begin
  if auth.uid() is null then raise exception 'Not authorised'; end if;
  insert into public.buyer_wallets(user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select * into v_wallet from public.buyer_wallets where user_id = auth.uid();
  return v_wallet;
end; $$;
grant execute on function public.get_or_create_buyer_wallet() to authenticated;

create or replace function public.set_buyer_wallet_account(p_account_number text, p_account_name text, p_bank_name text, p_account_reference text) returns public.buyer_wallets language plpgsql security definer set search_path = public as $$
declare v_wallet public.buyer_wallets;
begin
  if auth.uid() is null then raise exception 'Not authorised'; end if;
  update public.buyer_wallets set dedicated_account_number = p_account_number, dedicated_account_name = p_account_name, dedicated_bank_name = p_bank_name, dedicated_account_reference = p_account_reference where user_id = auth.uid() returning * into v_wallet;
  if not found then raise exception 'Buyer wallet not found'; end if;
  return v_wallet;
end; $$;
grant execute on function public.set_buyer_wallet_account(text,text,text,text) to authenticated;
