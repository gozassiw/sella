-- Sella Stage 33: authenticated order notification writes.

create or replace function public.notify_order_user(
  p_order_id uuid,
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text
)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare
  v_order public.orders%rowtype;
  v_owner_id uuid;
  v_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'Order not found'; end if;
  select owner_id into v_owner_id from public.stores where id = v_order.store_id;
  if p_user_id is distinct from v_order.buyer_id and p_user_id is distinct from v_owner_id then raise exception 'Notification recipient is not part of this order'; end if;
  if auth.uid() is distinct from v_order.buyer_id and auth.uid() is distinct from v_owner_id and not public.is_platform_admin() then raise exception 'Notification access denied'; end if;
  insert into public.notifications(user_id, type, title, body, link) values (p_user_id, coalesce(nullif(p_type, ''), 'order'), p_title, p_body, p_link) returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.notify_order_user(uuid, uuid, text, text, text, text) to authenticated;
notify pgrst, 'reload schema';
