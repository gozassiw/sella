-- Sella Stage 53: exact participant names in buyer and seller chat inboxes.
-- The caller must already be one of the two participants in a paid-order chat.

create or replace function public.get_chat_participant_name(
  p_conversation_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_conversation public.chat_conversations%rowtype;
  v_owner_id uuid;
  v_name text;
begin
  select * into v_conversation
  from public.chat_conversations
  where id = p_conversation_id;

  if not found or not public.can_access_chat(p_conversation_id) then
    raise exception 'Chat access denied';
  end if;

  select owner_id into v_owner_id
  from public.stores
  where id = v_conversation.store_id;

  if auth.uid() = v_owner_id then
    select nullif(trim(bp.full_name), '') into v_name
    from public.buyer_profiles bp
    where bp.user_id = v_conversation.buyer_id
    limit 1;
  elsif auth.uid() = v_conversation.buyer_id then
    select nullif(trim(s.name), '') into v_name
    from public.stores s
    where s.id = v_conversation.store_id
    limit 1;
  else
    raise exception 'Chat participant denied';
  end if;

  return coalesce(v_name, 'Sella user');
end;
$$;

revoke all on function public.get_chat_participant_name(uuid) from public;
grant execute on function public.get_chat_participant_name(uuid) to authenticated;

notify pgrst, 'reload schema';
