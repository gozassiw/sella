-- Sella Stage 12: refreshed green brand default.
alter table public.stores alter column brand_color set default '#137A52';
update public.stores
set brand_color = '#137A52'
where brand_color in ('#1B2A57', '#176B4D');
