-- Sella Stage 47: message report validation and private chat media policies.

drop policy if exists "reports: reporter insert" on public.reports;
create policy "reports: reporter insert" on public.reports
for insert to authenticated
with check (
  reported_by = auth.uid()
  and (
    type <> 'message'
    or (
      message_id is not null
      and exists (
        select 1
        from public.chat_messages m
        where m.id = reports.message_id
          and public.can_access_chat(m.conversation_id)
      )
    )
  )
);

-- The application server uploads and signs private chat images with the service role.
-- No anonymous or authenticated direct object access is granted to this bucket.
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do update set public = false;

notify pgrst, 'reload schema';
