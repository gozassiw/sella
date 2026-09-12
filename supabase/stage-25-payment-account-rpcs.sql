-- Sella Stage 25: authenticated payment-account metadata writes.

create or replace function public.set_order_payment_account(p_order_id uuid, p_account_number text, p_account_name text default null, p_bank_name text default null, p_payment_reference text default null)
returns public.orders language plpgsql security definer set search_path = public, auth as $$
declare v_order public.orders;
begin
  if auth.uid() is null then raise exception 'Not authorised'; end if;
  update public.orders set payment_account_number = p_account_number, payment_account_name = p_account_name, payment_bank_name = p_bank_name, payment_reference = coalesce(p_payment_reference, payment_reference) where id = p_order_id and buyer_id = auth.uid() returning * into v_order;
  if not found then raise exception 'Order not found'; end if;
  return v_order;
end;
$$;
grant execute on function public.set_order_payment_account(uuid, text, text, text, text) to authenticated;

create or replace function public.set_subscription_payment_account(p_subscription_id uuid, p_account_number text, p_account_name text default null, p_bank_name text default null, p_payment_reference text default null)
returns public.subscriptions language plpgsql security definer set search_path = public, auth as $$
declare v_subscription public.subscriptions;
begin
  if auth.uid() is null then raise exception 'Not authorised'; end if;
  update public.subscriptions s set payment_account_number = p_account_number, payment_account_name = p_account_name, payment_bank_name = p_bank_name, payment_reference = coalesce(p_payment_reference, payment_reference) from public.stores st where s.id = p_subscription_id and st.id = s.store_id and st.owner_id = auth.uid() returning s.* into v_subscription;
  if not found then raise exception 'Subscription not found'; end if;
  return v_subscription;
end;
$$;
grant execute on function public.set_subscription_payment_account(uuid, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
