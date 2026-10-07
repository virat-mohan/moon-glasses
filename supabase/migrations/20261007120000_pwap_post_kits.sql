create table if not exists public.pwap_post_kits (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  code text not null unique,
  product_slug text not null,
  image_path text not null,
  sales_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists pwap_post_kits_order_idx on public.pwap_post_kits(order_id);
create index if not exists pwap_post_kits_slug_idx on public.pwap_post_kits(product_slug, created_at desc);
alter table public.pwap_post_kits enable row level security;
-- no policies: service role only
