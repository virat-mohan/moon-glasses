-- Test orders: placed by an admin session to walk the journey; nothing ships, no stock, no counters.
alter table public.orders add column if not exists is_test boolean not null default false;
create index if not exists orders_is_test_idx on public.orders (is_test) where is_test;
