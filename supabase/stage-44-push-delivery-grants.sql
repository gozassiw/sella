-- Sella Stage 44: restore server-side push delivery privileges.
-- The service-role client reads subscriptions and updates delivery health.

grant usage on schema public to service_role;
grant select, update on table public.push_subscriptions to service_role;

notify pgrst, 'reload schema';
