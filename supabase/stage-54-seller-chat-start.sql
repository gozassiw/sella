-- Sella Stage 54: allow a seller to open the existing buyer-store thread.
-- Chat remains available only after a paid order and only to the store owner.

create or replace function public.get_or_create_chat_conversation_for_seller(
  p_store_id uuid,
  p_buyer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
  v_order public.orders%rowtype;
begin
  if auth.uid() is null then raise exception 'Please log in'; end if;
  if not exists (select 1 from public.stores where id = p_store_id and owner_id = auth.uid()) then
    raise exception 'Only the store owner can open this conversation.';
  end if;
  if not exists (select 1 from public.orders where store_id = p_store_id and buyer_id = p_buyer_id and payment_status = 'paid') then
    raise exception 'Chat unlocks after the buyer has paid for an order.';
  end if;

  insert into public.chat_conversations(store_id, buyer_id)
  values (p_store_id, p_buyer_id)
  on conflict (store_id, buyer_id) do update set last_message_at = public.chat_conversations.last_message_at
  returning id into v_id;

  for v_order in
    select * from public.orders
    where store_id = p_store_id and buyer_id = p_buyer_id and payment_status = 'paid'
    order by paid_at asc nulls last, created_at asc
  loop
    perform public.record_order_chat_event(v_order.id, 'paid');
  end loop;

  return jsonb_build_object('id', v_id, 'store_id', p_store_id, 'buyer_id', p_buyer_id);
end;
$$;

revoke all on function public.get_or_create_chat_conversation_for_seller(uuid, uuid) from public;
grant execute on function public.get_or_create_chat_conversation_for_seller(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
