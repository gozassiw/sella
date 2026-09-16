-- Sella Stage 74: allow only the server-side service role to use launch tables.
-- Anonymous and authenticated clients remain blocked by the existing revokes and RLS.
grant select, insert, update on public.launch_waitlist to service_role;
grant select, insert, update on public.launch_preview_tokens to service_role;
notify pgrst, 'reload schema';
