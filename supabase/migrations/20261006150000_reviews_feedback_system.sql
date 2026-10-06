-- Reviews & feedback system. Additive: new columns, one relaxed NOT NULL
-- (store-wide feedback has no order or product). No data is removed.
alter table public.reviews alter column order_id drop not null;
alter table public.reviews alter column chapter_slug drop not null;
alter table public.reviews add column if not exists kind text not null default 'product';
alter table public.reviews add column if not exists verified boolean not null default false;
alter table public.reviews add column if not exists status text not null default 'pending';
alter table public.reviews add column if not exists admin_reply text;
alter table public.reviews add column if not exists replied_at timestamptz;
alter table public.reviews add column if not exists source text not null default 'order_page';
alter table public.reviews add column if not exists contact text;
alter table public.reviews add column if not exists flagged_reason text;
alter table public.reviews add column if not exists alerted_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reviews_status_check') then
    alter table public.reviews add constraint reviews_status_check check (status in ('pending','approved','hidden'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reviews_kind_check') then
    alter table public.reviews add constraint reviews_kind_check check (kind in ('product','store'));
  end if;
end $$;
update public.reviews set status = 'approved' where approved = true and status = 'pending';
create index if not exists reviews_status_idx on public.reviews (status);
alter table public.orders add column if not exists review_reminded_at timestamptz;
