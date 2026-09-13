-- Sella Stage 45: buyer-seller chat foundation.
-- One persistent thread per buyer/store pair, unlocked only after a paid order.

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (store_id, buyer_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  kind text not null default 'text' check (kind in ('text','image','system')),
  body text,
  image_path text,
  order_id uuid references public.orders(id) on delete set null,
  system_event text,
  created_at timestamptz not null default now(),
  constraint chat_messages_content_check check (
    (kind = 'text' and nullif(trim(body), '') is not null and image_path is null)
    or (kind = 'image' and nullif(trim(image_path), '') is not null)
    or (kind = 'system' and nullif(trim(body), '') is not null)
  ),
  unique (conversation_id, order_id, system_event)
);

alter table public.reports drop constraint if exists reports_type_check;
alter table public.reports add constraint reports_type_check check (type in ('order','store','product','message'));
alter table public.reports add column if not exists message_id uuid references public.chat_messages(id) on delete set null;
create index if not exists reports_message_idx on public.reports(message_id, created_at desc);

create index if not exists chat_conversations_buyer_idx on public.chat_conversations(buyer_id, last_message_at desc);
create index if not exists chat_conversations_store_idx on public.chat_conversations(store_id, last_message_at desc);
create index if not exists chat_messages_conversation_idx on public.chat_messages(conversation_id, created_at desc);

insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do update set public = false;

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

drop function if exists public.can_access_chat(uuid);
create or replace function public.can_access_chat(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.chat_conversations c
      where c.id = p_conversation_id
        and (c.buyer_id = auth.uid() or exists (
          select 1 from public.stores s where s.id = c.store_id and s.owner_id = auth.uid()
        ))
        and exists (
          select 1 from public.orders o
          where o.store_id = c.store_id
            and o.buyer_id = c.buyer_id
            and o.payment_status = 'paid'
        )
    );
$$;
grant execute on function public.can_access_chat(uuid) to authenticated;

drop policy if exists chat_conversations_select on public.chat_conversations;
create policy chat_conversations_select on public.chat_conversations
for select to authenticated using (public.can_access_chat(id));

drop policy if exists chat_conversations_insert on public.chat_conversations;
create policy chat_conversations_insert on public.chat_conversations
for insert to authenticated
with check (
  buyer_id = auth.uid()
  and exists (
    select 1 from public.orders o
    where o.store_id = chat_conversations.store_id
      and o.buyer_id = auth.uid()
      and o.payment_status = 'paid'
  )
);

drop policy if exists chat_conversations_update on public.chat_conversations;
create policy chat_conversations_update on public.chat_conversations
for update to authenticated using (public.can_access_chat(id)) with check (public.can_access_chat(id));

drop policy if exists chat_messages_select on public.chat_messages;
create policy chat_messages_select on public.chat_messages
for select to authenticated using (public.can_access_chat(conversation_id));

drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages
for insert to authenticated
with check (sender_id = auth.uid() and kind in ('text','image') and public.can_access_chat(conversation_id));

create or replace function public.get_or_create_chat_conversation(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
  v_store public.stores%rowtype;
begin
  if auth.uid() is null then raise exception 'Please log in'; end if;
  if not exists (
    select 1 from public.orders
    where store_id = p_store_id and buyer_id = auth.uid() and payment_status = 'paid'
  ) then raise exception 'Chat unlocks after your first paid order with this store.'; end if;
  select * into v_store from public.stores where id = p_store_id and approval_status = 'approved';
  if not found then raise exception 'Store not found'; end if;
  insert into public.chat_conversations(store_id, buyer_id)
  values (p_store_id, auth.uid())
  on conflict (store_id, buyer_id) do update set last_message_at = public.chat_conversations.last_message_at
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'store_id', p_store_id, 'buyer_id', auth.uid());
end;
$$;
grant execute on function public.get_or_create_chat_conversation(uuid) to authenticated;

create or replace function public.record_order_chat_event(p_order_id uuid, p_event text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_order public.orders%rowtype;
  v_store public.stores%rowtype;
  v_conversation_id uuid;
  v_title text;
  v_body text;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.payment_status <> 'paid' then return jsonb_build_object('recorded', false, 'reason', 'order_not_paid'); end if;
  select * into v_store from public.stores where id = v_order.store_id;
  if not found then return jsonb_build_object('recorded', false, 'reason', 'store_missing'); end if;
  if p_event not in ('paid','processing','shipped','delivered','cancelled') then raise exception 'Unsupported chat order event'; end if;
  if p_event = 'paid' then
    v_title := 'Payment confirmed';
    v_body := 'Payment confirmed for order #' || v_order.order_code || '.';
  elsif p_event = 'processing' then
    v_title := 'Order packed';
    v_body := 'Order #' || v_order.order_code || ' has been packed.';
  elsif p_event = 'shipped' then
    v_title := 'Out for delivery';
    v_body := 'Order #' || v_order.order_code || ' is out for delivery.';
  elsif p_event = 'delivered' then
    v_title := 'Order delivered';
    v_body := 'Order #' || v_order.order_code || ' has been marked delivered.';
  else
    v_title := 'Order cancelled';
    v_body := 'Order #' || v_order.order_code || ' was cancelled.';
  end if;
  insert into public.chat_conversations(store_id, buyer_id)
  values (v_order.store_id, v_order.buyer_id)
  on conflict (store_id, buyer_id) do nothing;
  select id into v_conversation_id from public.chat_conversations where store_id = v_order.store_id and buyer_id = v_order.buyer_id;
  insert into public.chat_messages(conversation_id, sender_id, kind, body, order_id, system_event)
  values (v_conversation_id, null, 'system', v_body, v_order.id, p_event)
  on conflict (conversation_id, order_id, system_event) do nothing;
  update public.chat_conversations set last_message_at = now() where id = v_conversation_id;
  return jsonb_build_object('recorded', true, 'conversation_id', v_conversation_id, 'event', p_event, 'title', v_title);
end;
$$;
grant execute on function public.record_order_chat_event(uuid, text) to authenticated;

drop function if exists public.notify_chat_recipient(uuid, uuid, text, text);
create or replace function public.notify_chat_recipient(p_conversation_id uuid, p_recipient_id uuid, p_body text, p_link text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_conversation public.chat_conversations%rowtype;
  v_owner_id uuid;
begin
  select * into v_conversation from public.chat_conversations where id = p_conversation_id;
  if not found or not public.can_access_chat(p_conversation_id) then raise exception 'Chat access denied'; end if;
  select owner_id into v_owner_id from public.stores where id = v_conversation.store_id;
  if auth.uid() is distinct from v_conversation.buyer_id and auth.uid() is distinct from v_owner_id then raise exception 'Chat sender denied'; end if;
  if p_recipient_id is not distinct from auth.uid() then return false; end if;
  if p_recipient_id is distinct from v_conversation.buyer_id and p_recipient_id is distinct from v_owner_id then raise exception 'Chat recipient denied'; end if;
  insert into public.notifications(user_id, type, title, body, link)
  values (p_recipient_id, 'chat', 'New message', left(coalesce(p_body, 'You have a new Sella message.'), 240), p_link);
  return true;
end;
$$;
grant execute on function public.notify_chat_recipient(uuid, uuid, text, text) to authenticated;

-- Add the chat tables to Supabase Realtime if they are not already present.
do $$
begin
  begin alter publication supabase_realtime add table public.chat_conversations; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.chat_messages; exception when duplicate_object then null; end;
end $$;

notify pgrst, 'reload schema';
