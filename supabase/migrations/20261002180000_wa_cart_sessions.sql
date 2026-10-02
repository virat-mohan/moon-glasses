-- WhatsApp catalogue ordering: one pending cart per phone while we collect the delivery address in chat.
create table if not exists public.wa_cart_sessions (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  name text,
  items jsonb not null,
  status text not null default 'pending' check (status in ('pending','ordered','expired','abandoned')),
  attempts int not null default 0,
  order_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create unique index if not exists wa_cart_sessions_one_pending on public.wa_cart_sessions (phone) where status = 'pending';
alter table public.wa_cart_sessions enable row level security; -- service role only
-- Channel report: where the order came from (e.g. 'whatsapp').
alter table public.orders add column if not exists order_source text;
