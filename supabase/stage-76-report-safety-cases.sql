-- Sella Stage 76: extend the existing reports table into buyer-safety cases.
-- This is additive and intentionally keeps legacy type/message_id/reason columns
-- so chat reporting and the existing Reports queue remain functional.

create extension if not exists "pgcrypto";

alter table public.reports add column if not exists case_ref text;
alter table public.reports add column if not exists buyer_id uuid references auth.users(id) on delete set null;
alter table public.reports add column if not exists report_reason text;
alter table public.reports add column if not exists updated_at timestamptz not null default now();
alter table public.reports add column if not exists closed_at timestamptz;

-- Existing migrations used open/resolved and chat added message reports. Keep those
-- values accepted for old callers while all new cases use the five title-cased statuses.
alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports add constraint reports_status_check check (status in ('open','resolved','Submitted','Under Review','Awaiting Seller Response','Resolved','Closed'));
update public.reports set status = 'Submitted' where status = 'open';
update public.reports set status = 'Resolved' where status = 'resolved';
update public.reports set report_reason = case
  when lower(reason) in ('suspicious or scam behaviour','suspected fraud') then 'suspected_fraud'
  when lower(reason) in ('fake products','counterfeit or prohibited products') then 'counterfeit_or_prohibited'
  when lower(reason) in ('wrong or misleading information','product significantly different from its description') then 'product_not_as_described'
  when lower(reason) = 'other' then 'other_concern'
  else coalesce(report_reason, 'other_concern')
end where report_reason is null;

create or replace function public.next_report_case_ref()
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  candidate text;
begin
  loop
    candidate := 'SLC-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    exit when not exists (select 1 from public.reports where case_ref = candidate);
  end loop;
  return candidate;
end;
$$;

update public.reports set case_ref = public.next_report_case_ref() where case_ref is null;
alter table public.reports alter column case_ref set default public.next_report_case_ref();
alter table public.reports alter column case_ref set not null;
create unique index if not exists reports_case_ref_key on public.reports(case_ref);
create index if not exists reports_buyer_idx on public.reports(buyer_id, created_at desc);
create index if not exists reports_status_idx on public.reports(status, created_at desc);

-- Backfill buyer linkage for order reports where the current orders table has buyer_id.
-- This runs after later order migrations in the normal stage sequence.
update public.reports r set buyer_id = o.buyer_id
from public.orders o
where r.order_id = o.id and r.reported_by = o.buyer_id and r.buyer_id is null;
update public.reports set buyer_id=reported_by where buyer_id is null and type<>'message';

create table if not exists public.report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  visibility text not null default 'admin' check (visibility in ('admin','buyer','seller','seller_buyer')),
  event_type text not null check (event_type in ('status_change','internal_note','seller_request','seller_response','admin_action','system')),
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists report_events_report_idx on public.report_events(report_id, created_at asc);

create table if not exists public.report_evidence (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/gif','application/pdf')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 2097152),
  created_at timestamptz not null default now()
);
create index if not exists report_evidence_report_idx on public.report_evidence(report_id, created_at asc);

-- A separate audit stream avoids relying on the historical admin_audit_logs shape.
create table if not exists public.report_audit_log (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists report_audit_report_idx on public.report_audit_log(report_id, created_at desc);

create or replace function public.normalize_report_status()
returns trigger language plpgsql as $$
begin
  if new.status = 'open' then new.status := 'Submitted'; end if;
  if new.status = 'resolved' then new.status := 'Resolved'; end if;
  new.updated_at := now();
  if new.status = 'Closed' and old.status is distinct from 'Closed' then new.closed_at := now(); end if;
  return new;
end;
$$;
drop trigger if exists reports_normalize_status on public.reports;
create trigger reports_normalize_status before update on public.reports for each row execute function public.normalize_report_status();

create or replace function public.record_report_status_change()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if new.status is distinct from old.status then
    insert into public.report_events(report_id, actor_id, visibility, event_type, body, metadata)
    values (new.id, auth.uid(), 'buyer', 'status_change', 'Your report is now ' || new.status || '.', jsonb_build_object('from', old.status, 'to', new.status));
    insert into public.report_audit_log(report_id, actor_id, action, details)
    values (new.id, auth.uid(), 'status_change', jsonb_build_object('from', old.status, 'to', new.status));
    if new.buyer_id is not null then
      insert into public.notifications(user_id, type, title, body, link)
      values (new.buyer_id, 'report', 'Report status updated', 'Your report ' || new.case_ref || ' is now ' || new.status || '.', '/account/reports/' || new.id);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists reports_status_history on public.reports;
create trigger reports_status_history after update on public.reports for each row execute function public.record_report_status_change();

create or replace function public.seed_report_case_defaults()
returns trigger language plpgsql as $$
begin
  if new.case_ref is null or new.case_ref = '' then new.case_ref := public.next_report_case_ref(); end if;
  if new.status in ('open','resolved') then new.status := case when new.status = 'resolved' then 'Resolved' else 'Submitted' end; end if;
  if new.report_reason is null or new.report_reason = '' then new.report_reason := 'other_concern'; end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists reports_case_defaults on public.reports;
create trigger reports_case_defaults before insert on public.reports for each row execute function public.seed_report_case_defaults();

-- Private evidence bucket. No public policy is created. Only server routes using
-- the service-role client can upload or create short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('report-evidence', 'report-evidence', false)
on conflict (id) do update set public = false;
drop policy if exists "report evidence no public reads" on storage.objects;
drop policy if exists "report evidence no client writes" on storage.objects;

alter table public.report_events enable row level security;
alter table public.report_evidence enable row level security;
alter table public.report_audit_log enable row level security;
drop policy if exists report_events_buyer_read on public.report_events;
create policy report_events_buyer_read on public.report_events for select using (
  visibility in ('buyer','seller_buyer') and exists (select 1 from public.reports r where r.id = report_id and r.buyer_id = auth.uid())
);
drop policy if exists report_events_seller_read on public.report_events;
create policy report_events_seller_read on public.report_events for select using (
  visibility in ('seller','seller_buyer') and exists (
    select 1 from public.reports r join public.stores s on s.id = r.store_id where r.id = report_id and s.owner_id = auth.uid()
  )
);
drop policy if exists report_evidence_owner_read on public.report_evidence;
create policy report_evidence_owner_read on public.report_evidence for select using (
  uploaded_by = auth.uid() and exists (select 1 from public.reports r where r.id = report_id and r.buyer_id = auth.uid())
);
drop policy if exists report_evidence_owner_insert on public.report_evidence;
create policy report_evidence_owner_insert on public.report_evidence for insert with check (
  uploaded_by = auth.uid() and exists (select 1 from public.reports r where r.id = report_id and r.buyer_id = auth.uid())
);

-- New client reports are constrained by the route's ownership validation. These
-- policies also prevent browser callers from spoofing reporter/buyer identity.
drop policy if exists "reports: reporter insert" on public.reports;
create policy "reports: reporter insert" on public.reports for insert with check (reported_by = auth.uid() and (buyer_id is null or buyer_id = auth.uid()));
drop policy if exists reports_buyer_read_case on public.reports;
create policy reports_buyer_read_case on public.reports for select using (buyer_id = auth.uid() or reported_by = auth.uid());

notify pgrst, 'reload schema';

create or replace function public.report_admin_action(p_report_id uuid, p_action text, p_status text default null, p_body text default null, p_seller_visible boolean default false)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare v_report public.reports%rowtype;
begin
  if not public.is_platform_admin() then raise exception 'Admin access required'; end if;
  select * into v_report from public.reports where id = p_report_id for update;
  if not found then raise exception 'Report not found'; end if;
  if p_action = 'status' then
    if p_status is null or p_status not in ('Submitted','Under Review','Awaiting Seller Response','Resolved','Closed') then raise exception 'Invalid report status'; end if;
    update public.reports set status = p_status where id = p_report_id;
    if p_body is not null and length(trim(p_body)) > 0 then
      insert into public.report_events(report_id, actor_id, visibility, event_type, body) values (p_report_id, auth.uid(), case when p_seller_visible then 'seller_buyer' else 'buyer' end, 'status_change', left(trim(p_body), 5000));
    end if;
  elsif p_action = 'internal_note' then
    if p_body is null or length(trim(p_body)) = 0 then raise exception 'Note is required'; end if;
    insert into public.report_events(report_id, actor_id, visibility, event_type, body) values (p_report_id, auth.uid(), 'admin', 'internal_note', left(trim(p_body), 5000));
  elsif p_action = 'seller_request' then
    if p_body is null or length(trim(p_body)) = 0 then raise exception 'Seller question is required'; end if;
    insert into public.report_events(report_id, actor_id, visibility, event_type, body) values (p_report_id, auth.uid(), 'seller', 'seller_request', left(trim(p_body), 5000));
    update public.reports set status = 'Awaiting Seller Response' where id = p_report_id;
  elsif p_action = 'admin_action' then
    if p_body is null or length(trim(p_body)) = 0 then raise exception 'Action details are required'; end if;
    insert into public.report_events(report_id, actor_id, visibility, event_type, body) values (p_report_id, auth.uid(), 'admin', 'admin_action', left(trim(p_body), 5000));
  else raise exception 'Unknown report action';
  end if;
  insert into public.report_audit_log(report_id, actor_id, action, details) values (p_report_id, auth.uid(), p_action, jsonb_build_object('status', p_status, 'seller_visible', p_seller_visible, 'body_present', p_body is not null));
  return jsonb_build_object('success', true, 'report_id', p_report_id);
end;
$$;
grant execute on function public.report_admin_action(uuid, text, text, text, boolean) to authenticated;

create or replace function public.report_seller_response(p_report_id uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare v_report public.reports%rowtype;
begin
  if p_body is null or length(trim(p_body)) = 0 or length(trim(p_body)) > 5000 then raise exception 'Response must be between 1 and 5000 characters'; end if;
  select r.* into v_report from public.reports r join public.stores s on s.id = r.store_id where r.id = p_report_id and s.owner_id = auth.uid() for update of r;
  if not found then raise exception 'Seller access denied'; end if;
  if v_report.status <> 'Awaiting Seller Response' or not exists(select 1 from public.report_events where report_id=p_report_id and event_type='seller_request') then raise exception 'This case is not awaiting your response'; end if;
  insert into public.report_events(report_id, actor_id, visibility, event_type, body) values (p_report_id, auth.uid(), 'seller', 'seller_response', left(trim(p_body), 5000));
  update public.reports set status = case when status = 'Awaiting Seller Response' then 'Under Review' else status end where id = p_report_id;
  insert into public.report_audit_log(report_id, actor_id, action, details) values (p_report_id, auth.uid(), 'seller_response', jsonb_build_object('body_present', true));
  return jsonb_build_object('success', true);
end;
$$;
grant execute on function public.report_seller_response(uuid, text) to authenticated;


-- Preserve all unrelated admin_apply_action behaviour. Its legacy report_status
-- update is still authenticated-admin only and goes through the status audit trigger.
revoke all on public.report_events,public.report_evidence,public.report_audit_log from anon,authenticated;
revoke insert,update,delete,truncate,references,trigger on public.reports from anon,authenticated;
grant select,insert on public.reports to authenticated;
grant select on public.report_events,public.report_evidence to authenticated;
grant select,insert,update,delete on public.reports,public.report_events,public.report_evidence,public.report_audit_log to service_role;
alter table public.reports enable row level security;
drop policy if exists "reports: seller read own store" on public.reports;
drop policy if exists reports_seller_read_case on public.reports;
drop policy if exists "reports: reporter insert" on public.reports;
-- Preserve the existing chat-report API. New safety cases use the server-only
-- service role after authentication + ownership checks; browser writes cannot spoof them.
create policy "reports: reporter insert" on public.reports for insert to authenticated with check (
 type='message' and reported_by=auth.uid() and buyer_id is null
 and message_id is not null and status='Submitted'
 and exists(select 1 from public.chat_messages m where m.id=message_id and public.can_access_chat(m.conversation_id))
);
create policy reports_admin_case_read on public.reports for select to authenticated using(public.is_platform_admin());
create policy report_events_admin_read on public.report_events for select to authenticated using(public.is_platform_admin());
create policy report_evidence_admin_read on public.report_evidence for select to authenticated using(public.is_platform_admin());
drop policy if exists report_events_seller_read on public.report_events;
drop policy if exists report_evidence_owner_insert on public.report_evidence;
revoke all on function public.report_admin_action(uuid,text,text,text,boolean) from public,anon;
revoke all on function public.report_seller_response(uuid,text) from public,anon;
grant execute on function public.report_admin_action(uuid,text,text,text,boolean),public.report_seller_response(uuid,text) to authenticated;

create or replace function public.record_report_submission()
returns trigger language plpgsql security definer set search_path=public,auth,pg_temp as $$
begin
 insert into public.report_events(report_id,actor_id,visibility,event_type,body)
 values(new.id,new.reported_by,'buyer','system','Report received. Sella will review the information you provided.');
 insert into public.report_audit_log(report_id,actor_id,action,details)
 values(new.id,new.reported_by,'submitted',jsonb_build_object('type',new.type));
 return new;
end $$;
create trigger reports_submission_history after insert on public.reports for each row execute function public.record_report_submission();
notify pgrst,'reload schema';
