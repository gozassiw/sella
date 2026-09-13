-- Sella Stage 46: automatic chat system messages for paid orders and lifecycle changes.

create or replace function public.record_order_chat_event(p_order_id uuid, p_event text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_order public.orders%rowtype;
  v_conversation_id uuid;
  v_body text;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then return jsonb_build_object('recorded', false, 'reason', 'order_missing'); end if;
  if p_event <> 'cancelled' and v_order.payment_status <> 'paid' then return jsonb_build_object('recorded', false, 'reason', 'order_not_paid'); end if;
  if p_event = 'cancelled' and v_order.payment_status not in ('paid','refunded') then return jsonb_build_object('recorded', false, 'reason', 'order_not_paid'); end if;
  if p_event not in ('paid','processing','shipped','delivered','cancelled') then raise exception 'Unsupported chat order event'; end if;
  if p_event = 'paid' then v_body := 'Payment confirmed for order #' || v_order.order_code || '.';
  elsif p_event = 'processing' then v_body := 'Order #' || v_order.order_code || ' has been packed.';
  elsif p_event = 'shipped' then v_body := 'Order #' || v_order.order_code || ' is out for delivery.';
  elsif p_event = 'delivered' then v_body := 'Order #' || v_order.order_code || ' has been marked delivered.';
  else v_body := 'Order #' || v_order.order_code || ' was cancelled.';
  end if;
  insert into public.chat_conversations(store_id, buyer_id)
  values (v_order.store_id, v_order.buyer_id)
  on conflict (store_id, buyer_id) do nothing;
  select id into v_conversation_id from public.chat_conversations where store_id = v_order.store_id and buyer_id = v_order.buyer_id;
  insert into public.chat_messages(conversation_id, sender_id, kind, body, order_id, system_event)
  values (v_conversation_id, null, 'system', v_body, v_order.id, p_event)
  on conflict (conversation_id, order_id, system_event) do nothing;
  update public.chat_conversations set last_message_at = now() where id = v_conversation_id;
  return jsonb_build_object('recorded', true, 'conversation_id', v_conversation_id, 'event', p_event);
end;
$$;
grant execute on function public.record_order_chat_event(uuid, text) to authenticated, anon;

create or replace function public.sync_order_chat_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    perform public.record_order_chat_event(new.id, 'paid');
  end if;
  if new.status is distinct from old.status and new.payment_status in ('paid','refunded') then
    if new.status = 'processing' then perform public.record_order_chat_event(new.id, 'processing');
    elsif new.status = 'shipped' then perform public.record_order_chat_event(new.id, 'shipped');
    elsif new.status = 'delivered' then perform public.record_order_chat_event(new.id, 'delivered');
    elsif new.status = 'cancelled' then perform public.record_order_chat_event(new.id, 'cancelled');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_chat_event_trigger on public.orders;
create trigger orders_chat_event_trigger
after update on public.orders
for each row execute function public.sync_order_chat_events();

-- Backfill paid-order context for a thread when a buyer opens chat later.
create or replace function public.get_or_create_chat_conversation(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
  v_paid_order public.orders%rowtype;
begin
  if auth.uid() is null then raise exception 'Please log in'; end if;
  if not exists (select 1 from public.orders where store_id = p_store_id and buyer_id = auth.uid() and payment_status = 'paid') then
    raise exception 'Chat unlocks after your first paid order with this store.';
  end if;
  insert into public.chat_conversations(store_id, buyer_id)
  values (p_store_id, auth.uid())
  on conflict (store_id, buyer_id) do update set last_message_at = public.chat_conversations.last_message_at
  returning id into v_id;
  for v_paid_order in select * from public.orders where store_id = p_store_id and buyer_id = auth.uid() and payment_status = 'paid' order by paid_at asc nulls last, created_at asc loop
    perform public.record_order_chat_event(v_paid_order.id, 'paid');
  end loop;
  return jsonb_build_object('id', v_id, 'store_id', p_store_id, 'buyer_id', auth.uid());
end;
$$;
grant execute on function public.get_or_create_chat_conversation(uuid) to authenticated;

notify pgrst, 'reload schema';
