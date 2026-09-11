-- Sella Stage 11: public product reports.
alter table public.reports add column if not exists product_id uuid references public.products(id) on delete set null;
alter table public.reports drop constraint if exists reports_type_check;
alter table public.reports add constraint reports_type_check check (type in ('order','store','product'));
create index if not exists reports_product_idx on public.reports(product_id, created_at desc);
