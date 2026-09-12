-- Sella Stage 36: distinguish an unset cost price from a genuine zero-cost item.

alter table public.products alter column cost_price drop not null;
alter table public.products alter column cost_price drop default;
alter table public.order_items alter column cost_price drop not null;
alter table public.order_items alter column cost_price drop default;
update public.products set cost_price = null where cost_price = 0;
update public.order_items set cost_price = null where cost_price = 0;
notify pgrst, 'reload schema';
