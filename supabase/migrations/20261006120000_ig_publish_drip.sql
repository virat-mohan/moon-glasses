-- Instagram drip publisher columns. NOT applied. Run after 20261005120000_ig_publish_queue.sql.
alter table ig_publish_queue
  add column if not exists scheduled_for timestamptz,
  add column if not exists posted_at timestamptz,        -- set atomically BEFORE posting; a retry can never double-post
  add column if not exists ig_post_id text,
  add column if not exists story_started_at timestamptz, -- set atomically BEFORE the story is posted
  add column if not exists story_id text,
  add column if not exists error text;                   -- any error stops the whole queue until cleared
