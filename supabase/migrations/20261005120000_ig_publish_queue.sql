-- Review queue for the Instagram catalogue drip (@moonglassesonline). NOT applied to production yet.
-- Content lives in data/ig-review/queue.json; this table only holds Virat's decisions and caption edits.
create table if not exists ig_publish_queue (
  id text primary key,                       -- product slug
  status text not null default 'review' check (status in ('review','approved','held')),
  caption text,                              -- edited caption, null = use the generated one
  note text,
  decided_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table ig_publish_queue enable row level security;  -- server (service role) only
