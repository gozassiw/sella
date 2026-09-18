-- Server-side report validation reads the related store, and seller-owned
-- order status changes are applied only after application ownership checks.
grant select on table public.stores to service_role;
grant select, update on table public.orders to service_role;
