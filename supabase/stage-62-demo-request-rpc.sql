-- Sella Stage 62: use a protected RPC for public demo-request creation.
create or replace function public.create_demo_request(
  p_name text,
  p_whatsapp text,
  p_requested_day date,
  p_time_slot text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
begin
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(coalesce(p_name, ''))) > 120 then
    raise exception 'Enter a valid name.';
  end if;
  if length(trim(coalesce(p_whatsapp, ''))) < 7 or length(trim(coalesce(p_whatsapp, ''))) > 40 then
    raise exception 'Enter a valid WhatsApp number.';
  end if;
  if p_requested_day < current_date then raise exception 'Choose a current or future demo day.'; end if;
  if p_time_slot not in ('10am–12pm', '12pm–2pm', '2pm–4pm', '4pm–6pm') then raise exception 'Choose an available time slot.'; end if;

  insert into public.demo_requests(name, whatsapp, requested_day, time_slot)
  values (trim(p_name), trim(p_whatsapp), p_requested_day, p_time_slot)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_demo_request(text, text, date, text) from public, anon, authenticated;
grant execute on function public.create_demo_request(text, text, date, text) to service_role;
notify pgrst, 'reload schema';
