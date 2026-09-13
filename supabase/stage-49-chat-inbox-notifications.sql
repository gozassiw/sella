-- Sella Stage 49: sender-aware chat notifications and per-conversation inbox state.

alter table public.chat_conversations
  add column if not exists buyer_last_read_at timestamptz,
  add column if not exists seller_last_read_at timestamptz;

create or replace function public.notify_chat_recipient(
  p_conversation_id uuid,
  p_recipient_id uuid,
  p_body text,
  p_link text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_conversation public.chat_conversations%rowtype;
  v_owner_id uuid;
  v_sender_name text;
  v_title text;
begin
  select * into v_conversation from public.chat_conversations where id = p_conversation_id;
  if not found or not public.can_access_chat(p_conversation_id) then raise exception 'Chat access denied'; end if;
  select owner_id into v_owner_id from public.stores where id = v_conversation.store_id;
  if auth.uid() is distinct from v_conversation.buyer_id and auth.uid() is distinct from v_owner_id then raise exception 'Chat sender denied'; end if;
  if p_recipient_id is not distinct from auth.uid() then return false; end if;
  if p_recipient_id is distinct from v_conversation.buyer_id and p_recipient_id is distinct from v_owner_id then raise exception 'Chat recipient denied'; end if;
  if auth.uid() = v_conversation.buyer_id then
    select coalesce(nullif(trim(full_name), ''), 'Buyer') into v_sender_name from public.buyer_profiles where user_id = auth.uid() limit 1;
  else
    select coalesce(nullif(trim(name), ''), 'Seller') into v_sender_name from public.stores where id = v_conversation.store_id limit 1;
  end if;
  v_title := 'New message from ' || coalesce(v_sender_name, 'Sella user');
  insert into public.notifications(user_id, type, title, body, link)
  values (p_recipient_id, 'chat', v_title, left(coalesce(p_body, 'You have a new Sella message.'), 240), p_link);
  return true;
end;
$$;
grant execute on function public.notify_chat_recipient(uuid, uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
