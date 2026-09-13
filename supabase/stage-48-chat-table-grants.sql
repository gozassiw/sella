-- Sella Stage 48: grant table privileges required by chat RLS policies.
-- The previous chat migration created policies but omitted base table grants,
-- which caused PostgREST to return permission denied before evaluating RLS.

grant select, insert, update on public.chat_conversations to authenticated;
grant select, insert on public.chat_messages to authenticated;

notify pgrst, 'reload schema';
