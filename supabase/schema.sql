-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  delivery_address text not null,
  subtotal integer not null, -- in INR, whole rupees, before discount
  status text not null default 'pending_whatsapp_confirmation'
);

-- These were originally listed inside the CREATE TABLE above, but that's a
-- no-op on an already-existing table (same lesson as otp_codes.email and
-- customers.phone further down) — orders already existed in production
-- before this file was the source of truth, so every one of these silently
-- never landed until made an explicit ALTER. Confirmed missing in production
-- 2026-08-17 via direct query, despite schema.sql having been re-run.
alter table orders add column if not exists discount_amount integer not null default 0;
alter table orders add column if not exists total integer not null default 0; -- subtotal - discount_amount
alter table orders add column if not exists shipment_status text not null default 'not_shipped';
alter table orders add column if not exists shiprocket_order_id text;
alter table orders add column if not exists refund_status text not null default 'none'; -- none | requested | approved | refunded | denied
alter table orders add column if not exists is_gift boolean not null default false;
alter table orders add column if not exists gift_note text;

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  chapter_slug text not null,
  chapter_name text not null,
  unit_price integer not null,
  quantity integer not null
);

create index if not exists order_items_order_id_idx on order_items (order_id);

-- Inventory: one row per Chapter. stock_on_hand is decremented on sale and can be
-- bumped up manually from the admin when new stock arrives.
create table if not exists inventory (
  chapter_slug text primary key,
  stock_on_hand integer not null default 0,
  updated_at timestamptz not null default now()
);

-- (Earlier demo/placeholder inventory rows from before the MOON GLASSES
-- catalogue existed have been deleted — see the real 16-SKU seed further
-- below.)

-- Discount rules: simple "buy N, cheapest one at X% off" promos (e.g. buy 2 get
-- 3rd at half price = buy_quantity 3, discount_percent 50). Only one should be
-- active at a time — the app just takes the first active row it finds.
create table if not exists discount_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  buy_quantity integer not null,
  discount_percent integer not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Seed data, not meant to be re-inserted on every re-run of this file — no
-- unique constraint on discount_rules to key an ON CONFLICT off, so this
-- guards the same way instead. Confirmed the naive version above created
-- ~10 duplicate active rows in production from repeated schema.sql runs.
insert into discount_rules (name, buy_quantity, discount_percent, active)
select 'Buy 2, get 3rd at half price', 3, 50, true
where not exists (select 1 from discount_rules);

-- Chapters added from the admin (the original 16 stay hardcoded in lib/chapters.ts —
-- this table is only for new ones added later, and their images live in Supabase
-- Storage's "chapter-images" bucket rather than public/images/chapters).
create table if not exists dynamic_chapters (
  slug text primary key,
  name text not null,
  series text not null,
  story text not null,
  price integer not null default 1399,
  verified_on_site boolean not null default true,
  images text[] not null default '{}', -- full Storage URLs
  primary_image text not null,
  created_at timestamptz not null default now()
);

-- Per-chapter edits from /admin/edit-chapter — works for BOTH the static 16
-- and dynamic_chapters rows. Any column left null means "use the hardcoded
-- value" for that field. primary_image is either one of that chapter's
-- existing filenames (static) or a full Storage URL (dynamic).
create table if not exists chapter_hero_overrides (
  chapter_slug text primary key,
  primary_image text,
  price integer,
  story text,
  updated_at timestamptz not null default now()
);

-- Simple key/value store for admin-entered settings (e.g. Razorpay keys)
-- that need to be readable server-side without redeploying env vars.
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Razorpay/payment fields on an already-existing orders table (safe to
-- re-run — these are no-ops once applied).
alter table orders add column if not exists payment_status text not null default 'unpaid';
alter table orders add column if not exists razorpay_order_id text;
alter table orders add column if not exists razorpay_payment_id text;

-- Without this, the client's /verify call and Razorpay's payment.captured
-- webhook can both pass finalizeOrder's "does this order exist yet?" check
-- before either has inserted (they fire within milliseconds of each other)
-- and create two order rows for the same payment — two invoice emails, two
-- WhatsApp confirmations, double-counted revenue. This constraint plus the
-- unique-violation handling in lib/order-fulfillment.ts closes that race
-- regardless of timing.
create unique index if not exists orders_razorpay_payment_id_idx
  on orders (razorpay_payment_id)
  where razorpay_payment_id is not null;

-- Claude-generated Journal article drafts from /admin/journal-drafts. These
-- are NOT auto-published — the live Journal is still the static list in
-- lib/journal.ts, so a draft has to be copied in by hand once it's approved.
create table if not exists journal_drafts (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  title text,
  subtitle text,
  category text,
  excerpt text,
  body text[],
  status text not null default 'draft', -- draft | ready | published | archived
  created_at timestamptz not null default now()
);
alter table journal_drafts add column if not exists related_chapter_slugs text[];
alter table journal_drafts add column if not exists reading_time int;
alter table journal_drafts add column if not exists published_slug text;
alter table journal_drafts add column if not exists hero_image text;

-- Live Journal articles published from a draft (see /admin/journal-drafts'
-- Publish button) — merged with the static journalArticles array in
-- lib/journal.ts at read time by lib/journal-dynamic.ts, same pattern as
-- chapters-dynamic.ts merges chapter_hero_overrides onto lib/chapters.ts.
create table if not exists journal_articles (
  slug text primary key,
  title text not null,
  subtitle text not null,
  category text not null,
  reading_time int not null default 4,
  published_at timestamptz not null default now(),
  hero_image text not null,
  excerpt text not null,
  body text[] not null,
  related_chapter_slugs text[] not null default '{}',
  issue int not null
);

-- Claude-generated ad copy + creative brief for a Chapter, from
-- /admin/ad-briefs. image_url is either an AI-generated image (via Gemini,
-- stored in the ad-creatives Storage bucket) or a real photo picked from
-- marketing_assets/chapter images — image_source tells you which.
-- Approving a brief creates a PAUSED Meta campaign/adset/ad; nothing ever
-- goes live without a human flipping it on in Meta Ads Manager.
create table if not exists ad_briefs (
  id uuid primary key default gen_random_uuid(),
  chapter_slug text,
  headline text,
  primary_text text,
  cta text,
  target_audience text,
  image_prompt text,
  image_url text,
  image_source text, -- generated | real
  status text not null default 'draft', -- draft | approved | launched | rejected
  meta_campaign_id text,
  meta_adset_id text,
  meta_ad_id text,
  created_at timestamptz not null default now()
);

-- Submissions from /community/add-your-chapter. Pending until an admin
-- approves them in /admin/explorer-submissions — only then do they show up
-- on the live Explorers wall (merged with the static filesystem-backed
-- photos in lib/community.ts) and, best-effort, get posted as an Instagram
-- Story.
create table if not exists explorer_submissions (
  id uuid primary key default gen_random_uuid(),
  photo_url text not null,
  testimonial text not null,
  location text,
  email text,
  chapter_slugs text[] not null default '{}',
  status text not null default 'pending', -- pending | approved | rejected
  instagram_posted boolean not null default false,
  created_at timestamptz not null default now()
);

-- Real product/lifestyle photos the admin uploads on purpose, to be used as
-- ad creatives directly (skip generation entirely) or as reference images fed
-- into image-gen for compositing — keeps ad creative costs down and grounded
-- in real photography rather than always generating from scratch.
create table if not exists marketing_assets (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  label text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- One row per anonymous shopper's cart, keyed by a client-generated
-- session_key stored alongside the cart in localStorage. Contact fields fill
-- in as soon as the shopper types them at checkout — that's what makes an
-- "abandoned cart" retargetable at all, since the cart itself is anonymous
-- until then. /api/cron/abandon-sweep flips 'active' rows stale for 45+
-- minutes to 'abandoned' and triggers a WhatsApp nudge; the Razorpay/WhatsApp
-- order routes flip a session to 'converted' the moment it becomes a real
-- order.
create table if not exists cart_sessions (
  id uuid primary key default gen_random_uuid(),
  session_key text unique not null,
  customer_name text,
  customer_phone text,
  customer_email text,
  items jsonb not null default '[]',
  subtotal integer,
  status text not null default 'active', -- active | converted | abandoned
  retargeted_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
-- Two-stage abandoned-cart sequence: retargeted_at is stage 1 (plain
-- reminder, 5 minutes after going idle); this is stage 2 (a BUYNOW10
-- coupon nudge, 2 hours after stage 1) — see app/api/cron/abandon-sweep.
alter table cart_sessions add column if not exists second_nudge_sent_at timestamptz;

-- Captured from the one-click "why didn't you buy" links in the BUYNOW10
-- nudge email — see /api/cart-feedback and lib/email.ts's sendBuyNow10Email.
-- abandon_reason is one of: price | designs | technical | later | other.
-- abandon_reason_note is only populated for 'other' (free text from the
-- /cart-feedback/other page).
alter table cart_sessions add column if not exists abandon_reason text;
alter table cart_sessions add column if not exists abandon_reason_note text;
alter table cart_sessions add column if not exists abandon_reason_at timestamptz;

-- Per-channel visibility into the abandoned-cart nudges — whichever channel
-- actually delivers a nudge (stage 1 or stage 2, whatsapp-first/email-fallback,
-- see lib/abandoned-cart.ts) stamps its own column here, independent of
-- retargeted_at/second_nudge_sent_at (which just guard against re-sending).
-- Lets /admin/abandoned-carts show each channel's last-sent time separately —
-- useful while WhatsApp delivery is down and only email is actually going out.
alter table cart_sessions add column if not exists last_whatsapp_sent_at timestamptz;
alter table cart_sessions add column if not exists last_email_sent_at timestamptz;

-- First-party funnel log — deliberately NOT dependent on Meta's pixel or any
-- third-party analytics being configured. This is what /admin/reports reads
-- to compute the funnel (views -> add to cart -> checkout -> purchase);
-- ad spend/clicks get joined in separately from Meta's own Insights API only
-- when Meta keys exist. event_name mirrors the standard Meta/GA4 vocabulary
-- (PageView, ViewContent, AddToCart, InitiateCheckout, Purchase) so wiring in
-- a second ad platform later is additive, not a rewrite.
create table if not exists tracking_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  session_key text,
  chapter_slug text,
  value integer,
  created_at timestamptz not null default now()
);
create index if not exists tracking_events_created_at_idx on tracking_events (created_at);

-- ============================================================
-- First-party website analytics (/admin/analytics) — built on the same
-- tracking_events log rather than a separate pipeline, so funnel numbers
-- and traffic numbers can never drift apart. path/referrer are only
-- populated going forward; older rows read as "(unknown)" in the UI.
-- ============================================================
alter table tracking_events add column if not exists path text;
alter table tracking_events add column if not exists referrer_host text; -- null = direct/internal navigation
create index if not exists tracking_events_session_idx on tracking_events (session_key, created_at);

-- Traffic-source classification: `ab` is the ad-brief id our own launched
-- Meta campaigns stamp on their landing URL (see app/api/admin/ad-briefs/launch),
-- so any session carrying one is unambiguously a paid click, not a guess
-- from referrer alone. utm_source is an optional manual tag (e.g. WhatsApp
-- broadcast links, which usually carry no referrer at all once opened) for
-- traffic sources the referrer can't identify on its own.
alter table tracking_events add column if not exists ad_brief_id uuid;
alter table tracking_events add column if not exists utm_source text;

-- ============================================================
-- Two-way WhatsApp inbox — lets /admin/whatsapp view and reply to customer
-- conversations without touching a phone. One conversation per phone
-- number; messages in both directions log here (separate from
-- whatsapp_messages, which is the one-way template-send log for
-- transactional nudges like abandoned-cart/OTP/RTO).
-- ============================================================
create table if not exists whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_phone text not null unique,
  customer_name text,
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  unread_count int not null default 0,
  created_at timestamptz not null default now()
);

-- Lets /admin/edit-chapter reorder a chapter's gallery images (the order
-- Product360Viewer cycles through on the chapter page) without touching
-- code. Null/empty means "use the static default order from lib/chapters.ts".
alter table chapter_hero_overrides add column if not exists images text[];

-- Admin-uploaded lifestyle/model shot for a Chapter's homepage tile hover-flip
-- (see CollectionItem). Null means "use the static lifestyle.jpg convention".
alter table chapter_hero_overrides add column if not exists model_image text;

-- Lets /admin/edit-chapter rename a product (including its SKU code, e.g.
-- "MOON P01 Wayfarer — Pale Blue") without a redeploy. Null means "use the
-- static name from lib/chapters.ts".
alter table chapter_hero_overrides add column if not exists name text;

-- Lets /admin/master-inventory move a CODE-BASED chapter (the static 16 or
-- Limited Series, whose collection/live status is otherwise hardcoded in
-- lib/chapters.ts / lib/limited-series.ts) between Core and Limited, or
-- unpublish it, without a redeploy. Null means "use the hardcoded default"
-- — dynamic_chapters rows (supplier drafts) already have their own
-- collection/live columns and never need this override.
alter table chapter_hero_overrides add column if not exists collection text;
alter table chapter_hero_overrides add column if not exists live boolean;

create table if not exists whatsapp_conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references whatsapp_conversations (id),
  direction text not null, -- inbound | outbound
  body text,
  media_url text,
  provider_message_id text,
  status text, -- outbound: sent | delivered | read | failed. inbound: received
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_conversation_messages_conv_idx
  on whatsapp_conversation_messages (conversation_id, created_at);

-- One row per WhatsApp send (order confirmation OR abandoned-cart retarget),
-- so /admin/reports can show open rate (delivered/read, via the MSG91
-- webhook) and conversion rate (converted, flipped by the order routes
-- when the linked cart_session becomes a real order) — not just "message
-- sent." interakt_message_id is a leftover from before MSG91 fully replaced
-- Interakt; harmless to keep, always null on new rows.
create table if not exists whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  cart_session_id uuid references cart_sessions (id),
  order_id uuid references orders (id),
  interakt_message_id text,
  msg91_message_id text,
  provider text not null default 'msg91',
  template_name text not null,
  status text not null default 'sent', -- sent | delivered | read | failed
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz,
  converted boolean not null default false
);

-- Weekly ROAS snapshots, generated on demand from /admin/reports (or by the
-- weekly cron once Vercel cron is available on your plan). Stored so the
-- report has history instead of only ever showing "right now."
create table if not exists weekly_reports (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  week_end date not null,
  ad_spend integer not null default 0,
  clicks integer not null default 0,
  impressions integer not null default 0,
  page_views integer not null default 0,
  add_to_carts integer not null default 0,
  checkouts_started integer not null default 0,
  orders_count integer not null default 0,
  revenue integer not null default 0,
  abandoned_carts integer not null default 0,
  roas numeric,
  created_at timestamptz not null default now()
);

-- Meta campaign/reel state on an ad_brief, plus the running audit log of
-- every autonomous action the ad agent takes on it.
alter table ad_briefs add column if not exists video_status text; -- none | generating | ready | failed
alter table ad_briefs add column if not exists video_operation_name text;
alter table ad_briefs add column if not exists video_url text;

-- Every action the ad agent takes (or explicitly declines to take) on a
-- launched campaign, with before/after values — this table IS the safety
-- mechanism for letting an agent touch ad spend at all. Read it before you
-- ever trust an autonomous action; it's designed to make second-guessing the
-- agent trivial.
create table if not exists agent_actions (
  id uuid primary key default gen_random_uuid(),
  ad_brief_id uuid references ad_briefs (id),
  action text not null, -- paused | budget_increased | budget_decreased | no_action
  reason text not null,
  before_value text,
  after_value text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Customer accounts: phone + OTP login, saved addresses, and a
-- Moonglasses Miles loyalty ledger.
-- ============================================================

-- One row per real customer, identified by phone and/or email — only one is
-- required at login, not both (checkout collects a phone/address separately
-- on every order regardless of account, so this never blocks shipping).
-- Created the first time someone verifies an OTP — there's no separate
-- signup step.
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  name text,
  email text,
  newsletter_subscribed boolean not null default true,
  created_at timestamptz not null default now()
);
-- phone used to be mandatory; email-only accounts are now allowed, so the
-- NOT NULL + plain UNIQUE from the original CREATE TABLE have to be relaxed
-- via ALTER (existing table, so the CREATE TABLE column list alone won't
-- take effect — same lesson as otp_codes.email above).
alter table customers alter column phone drop not null;
alter table customers drop constraint if exists customers_phone_key;
create unique index if not exists customers_phone_unique_idx on customers (phone) where phone is not null;
create unique index if not exists customers_email_unique_idx on customers (email) where email is not null;

-- Short-lived one-time codes for login. A row can key off phone, email, or
-- both — whichever the requester provided at least one of.
create table if not exists otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text,
  code text not null,
  expires_at timestamptz not null,
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists otp_codes_phone_idx on otp_codes (phone);
alter table otp_codes alter column phone drop not null;
-- Delivery channel while WhatsApp/SMS is still being set up. Added after
-- otp_codes already existed in production, so this has to be a separate
-- ALTER — CREATE TABLE IF NOT EXISTS is a no-op once the table is there,
-- it won't retroactively add columns.
alter table otp_codes add column if not exists email text;

-- Opaque bearer tokens set as an httpOnly cookie after OTP verification —
-- deliberately not a JWT, so a session can be revoked by deleting one row
-- instead of waiting out an expiry.
create table if not exists customer_sessions (
  token text primary key,
  customer_id uuid not null references customers (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text not null,
  address_line text not null,
  city text,
  state text,
  pincode text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Every Miles movement, positive (earned on a purchase) or negative
-- (redeemed at checkout) — balance is always sum(delta), never stored
-- directly, so it can't drift out of sync with what actually happened.
create table if not exists loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  delta integer not null,
  reason text not null,
  order_id uuid references orders (id),
  created_at timestamptz not null default now()
);
create index if not exists loyalty_ledger_customer_idx on loyalty_ledger (customer_id);

alter table orders add column if not exists customer_id uuid references customers (id);
alter table orders add column if not exists loyalty_discount_amount integer not null default 0;

-- ============================================================
-- Newsletter: guest signups (footer form) plus logged-in customers who
-- opted in — /admin/newsletter sends new Journal articles to the union of
-- both, deduplicated by email.
-- ============================================================

create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  subscribed_at timestamptz not null default now()
);

-- One row per Journal article ever sent, keyed by its static slug from
-- lib/journal.ts — prevents double-sending and is what /admin/newsletter
-- reads to show "sent" vs "not sent yet".
create table if not exists journal_newsletter_sends (
  article_slug text primary key,
  recipient_count integer not null default 0,
  sent_at timestamptz not null default now()
);

-- ============================================================
-- Legacy customer data imported from CSV via /admin/customers. Kept
-- separate from the real `orders` table on purpose — an imported row never
-- touched inventory, discount rules, or payment, so it must never be
-- mistaken for a real order. The customer master view in /admin/customers
-- merges this with real orders at read time, deduplicated by phone.
-- ============================================================
create table if not exists imported_customer_records (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  email text,
  purchase_date date,
  purchase_value integer,
  quantity integer,
  order_id text, -- the source system's order id, if the export had one (one row per order, not per line item)
  source_file text,
  imported_at timestamptz not null default now()
);
create index if not exists imported_customer_records_phone_idx on imported_customer_records (phone);

-- ============================================================
-- Shiprocket delivery. Structured address fields — Shiprocket's create-order
-- API requires city/state/pincode/country as separate fields, which the
-- original delivery_address free-text blob can't reliably supply. New
-- orders collect these at checkout going forward; older rows are left null
-- and shipping for them has to be created manually in Shiprocket directly.
-- ============================================================
alter table orders add column if not exists delivery_city text;
alter table orders add column if not exists delivery_state text;
alter table orders add column if not exists delivery_pincode text;
alter table orders add column if not exists shiprocket_shipment_id text;
alter table orders add column if not exists shiprocket_awb_code text;
alter table orders add column if not exists courier_name text;
-- Cached from generateShiprocketLabel at ship time — lets /admin/orders
-- print a label again later (e.g. the "2 labels per A4" merge) without
-- re-calling Shiprocket every time. Regenerated on demand if ever missing.
alter table orders add column if not exists shiprocket_label_url text;

-- ============================================================
-- Ad copy caption + hashtags, generated alongside the rest of an ad brief
-- so nothing gets typed by hand right before a post/ad goes out.
-- ============================================================
alter table ad_briefs add column if not exists hashtags text[];

-- ============================================================
-- CRM: leads captured from the Meta DM/comment bot (and, going forward,
-- other inbound channels) — deliberately separate from `customers`, since a
-- lead hasn't bought anything yet. `source` and `lead_type` are what make
-- this usable for lookalike audiences and retention marketing later:
-- source answers "where did this person come from" (meta_dm, meta_comment,
-- website, ...), lead_type answers "what do they want" (buying,
-- collaborating, general_enquiry). A lead is linked to the real customer
-- row once/if they actually place an order.
-- ============================================================
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  email text,
  source text not null, -- meta_dm | meta_comment | website | other
  lead_type text, -- buying | collaborating | general_enquiry
  platform text, -- instagram | facebook, when source is meta_*
  meta_user_id text, -- the sender's PSID/IGSID, for replying again later
  note text, -- free-text enquiry detail, or the chapter they asked about
  status text not null default 'new', -- new | contacted | converted | closed
  converted_customer_id uuid references customers(id),
  created_at timestamptz not null default now()
);
create index if not exists leads_meta_user_id_idx on leads (meta_user_id);
create index if not exists leads_status_idx on leads (status);

-- ============================================================
-- Meta DM bot conversation state — one row per (platform, sender), tracking
-- where they are in the "what's your name -> phone/email -> buying or
-- enquiring" flow so a reply a minute (or a day) later picks up where it
-- left off instead of restarting the script.
-- ============================================================
create table if not exists bot_conversations (
  id uuid primary key default gen_random_uuid(),
  platform text not null, -- instagram | facebook
  meta_user_id text not null,
  state text not null default 'greeting', -- greeting | awaiting_intent | awaiting_chapter | awaiting_contact | done
  profile_name text,
  intent text, -- buying | collaborating | general_enquiry
  chapter_slug text,
  collected_phone text,
  collected_email text,
  lead_id uuid references leads(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists bot_conversations_platform_user_idx on bot_conversations (platform, meta_user_id);

-- ============================================================
-- Shipping is a live cost pass-through from Shiprocket's rate-check API
-- (by delivery pincode + package weight), computed server-side and stored
-- alongside the order it was charged on.
-- ============================================================
alter table orders add column if not exists shipping_charge integer not null default 0;

-- ============================================================
-- COD with a mandatory small advance — customer pays a fixed advance
-- (e.g. ₹99) online to confirm the order, courier collects the rest on
-- delivery. This is the RTO-mitigation lever for COD specifically: a
-- shopper who's already put money down is a real commitment, not a free
-- option to refuse at the door, while still offering pay-on-delivery.
-- payment_status stays 'paid' when the advance is what's been collected
-- (in the sense that the order-confirming payment succeeded) — balance_due
-- is what distinguishes "fully settled" from "advance only".
-- ============================================================
alter table orders add column if not exists payment_type text not null default 'prepaid'; -- prepaid | cod_advance
alter table orders add column if not exists cod_advance_amount integer not null default 0;
alter table orders add column if not exists balance_due integer not null default 0;

-- ============================================================
-- Real ad attribution — which specific launched campaign (ad_brief) this
-- order actually traces back to, captured client-side from the `ab` query
-- param a campaign's landing URL carries (see the launch route and
-- lib/client-tracking.ts). This is what turns ROAS from a blended
-- account-wide estimate (weekly_reports.roas) into a true per-campaign
-- number the ad agent can actually trust to scale or pause spend.
-- No FK constraint deliberately — this is client-supplied analytics
-- metadata, not something an order should ever fail to save over; a stale
-- or malformed value just means the order's attribution is unknown, never
-- a reason to lose the order itself.
-- ============================================================
alter table orders add column if not exists attributed_ad_brief_id uuid;
create index if not exists orders_attributed_ad_brief_id_idx on orders (attributed_ad_brief_id);

-- ============================================================
-- "Notify me when back in stock" requests, on a sold-out Chapter's page —
-- reuses the leads table (source: website, lead_type: restock_notify) so
-- this is never a throwaway signup list, it's the same CRM everything else
-- feeds into. chapter_slug is what the inventory update route matches
-- against when stock goes from 0 to positive; status flips new -> contacted
-- once the notification email actually sends, so a lead is never emailed
-- twice for the same restock.
-- ============================================================
alter table leads add column if not exists chapter_slug text;
create index if not exists leads_chapter_slug_idx on leads (chapter_slug);

-- ============================================================
-- Referral program — the highest-leverage, lowest-cost acquisition channel
-- in D2C. Every customer gets a code (lazily generated on first account
-- access); a new shopper who checks out with someone's code gets a flat
-- discount, and the referrer earns Miles once that order actually closes.
-- Reward fires at order creation (same moment as normal purchase Miles),
-- not on delivery — consistent with how earnMilesForOrder already works.
-- ============================================================
alter table customers add column if not exists referral_code text unique;
alter table orders add column if not exists referral_code_used text;
alter table orders add column if not exists referral_discount_amount integer not null default 0;

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_customer_id uuid not null references customers(id),
  referred_order_id uuid references orders(id),
  referred_customer_id uuid references customers(id),
  referred_phone text,
  reward_miles integer not null default 0,
  status text not null default 'rewarded', -- rewarded | (reserved for future manual reversal on refund)
  created_at timestamptz not null default now()
);
create index if not exists referrals_referrer_idx on referrals (referrer_customer_id);

-- ============================================================
-- Post-delivery review collection. Triggered off the courier-status
-- webhook's transition into a "delivered" status — one request email per
-- order, linking to /review/[orderId], the same unguessable-UUID-as-
-- capability-link pattern the invoice page already uses (no login
-- needed). One review per order+chapter — a real duplicate submission
-- attempt just updates the existing row rather than creating a second.
-- Moderated (approved defaults false) before anything shows publicly, to
-- keep spam/inappropriate content off the site.
-- ============================================================
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  chapter_slug text not null,
  customer_name text not null,
  rating integer not null check (rating between 1 and 5),
  review_text text,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (order_id, chapter_slug)
);
create index if not exists reviews_chapter_slug_idx on reviews (chapter_slug);
create index if not exists reviews_approved_idx on reviews (approved);

alter table orders add column if not exists review_requested_at timestamptz;

-- ============================================================
-- Retention / win-back — nudges a customer whose most recent order was
-- >= WINBACK_AFTER_DAYS ago and hasn't been nudged in that same window,
-- so it naturally repeats every cycle for someone who still hasn't come
-- back, without ever spamming daily (the cron runs daily, but this
-- timestamp is what gates an actual send).
-- ============================================================
alter table customers add column if not exists last_winback_sent_at timestamptz;

-- ============================================================
-- Real Razorpay refunds (not just the refund_status label) and Shiprocket
-- return pickups, both triggerable from the admin dashboard.
-- ============================================================
alter table orders add column if not exists refunded_amount integer not null default 0;
alter table orders add column if not exists razorpay_refund_id text;
alter table orders add column if not exists return_shipment_id text;

-- ============================================================
-- RTO automation. On the transition into an RTO-in-transit status, the
-- customer gets a heads-up (rto_notified_at guards against a duplicate on a
-- retried webhook). On the transition into RTO actually being delivered back
-- to the pickup location — not just initiated — the order is auto-refunded
-- (subtotal + discount only; shipping stays non-refundable, the standard
-- D2C policy) and inventory is restocked (rto_processed_at guards the
-- one-time action). order_events is the audit trail this whole thing runs
-- on instead of a manual approval gate — every automatic action is logged
-- so it's reviewable/reversible after the fact rather than blocking on a
-- human before it happens.
-- ============================================================
alter table orders add column if not exists rto_notified_at timestamptz;
alter table orders add column if not exists rto_processed_at timestamptz;

create table if not exists order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  event_type text not null, -- rto_initiated | rto_refunded | rto_refund_failed | rto_restocked | ...
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_id_idx on order_events (order_id);

-- ============================================================
-- Pre-shipment cancellation (customer asks to cancel before it's shipped —
-- once it's picked up, nothing can reliably recall it, so that path routes
-- into refuse-at-door/RTO or a post-delivery return instead, not this).
-- No new columns needed — reuses orders.status, refunded_amount,
-- razorpay_refund_id, refund_status, same as every other refund path.
-- ============================================================

-- ============================================================
-- Customer-initiated returns (defect / wrong size) within a return window
-- measured from actual delivery, confirmed by Shiprocket's webhook — not a
-- guess from order date, since transit time varies by address. Reason
-- matters for the refund: a defect is the brand's fault (shipping
-- refunded too), wrong size follows the same policy as RTO (subtotal only).
-- "Changed my mind" is deliberately not an eligible reason.
-- ============================================================
alter table orders add column if not exists delivered_at timestamptz;

create table if not exists return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  reason text not null, -- defect | wrong_size
  note text,
  photo_url text,
  status text not null default 'requested', -- requested | approved | denied | received | refunded
  denial_reason text,
  return_shipment_id text,
  refunded_amount integer not null default 0,
  razorpay_refund_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists return_requests_order_id_idx on return_requests (order_id);
create index if not exists return_requests_status_idx on return_requests (status);
create index if not exists return_requests_shipment_id_idx on return_requests (return_shipment_id);

-- ============================================================
-- Carousel ad briefs — 4 distinct image prompts/images instead of one,
-- launched as a Meta carousel creative (child_attachments) rather than a
-- single-image link ad. image_prompt/image_url (singular) stay as they
-- were for non-carousel briefs; a carousel brief uses the plural columns
-- instead and leaves the singular ones null.
-- ============================================================
alter table ad_briefs add column if not exists is_carousel boolean not null default false;
alter table ad_briefs add column if not exists image_prompts text[];
alter table ad_briefs add column if not exists image_urls text[];

-- ============================================================
-- Claude decides the creative approach per (non-carousel) brief — a real
-- product photo with bold on-image text for promotional/urgent angles, or
-- a clean text-free AI lifestyle photo for aspirational/editorial ones —
-- instead of the admin guessing which style fits. overlay_text is only
-- meaningful when creative_style is 'real_photo_text_overlay'.
-- ============================================================
alter table ad_briefs add column if not exists creative_style text; -- ai_photo | real_photo_text_overlay
alter table ad_briefs add column if not exists overlay_text text;

-- ============================================================
-- Organic posting — publishing an ad brief's copy/image straight to
-- Instagram as a real feed post, no ad spend involved. Independent of the
-- Launch (paused ad campaign) action; a brief can be posted organically,
-- launched as an ad, both, or neither.
-- ============================================================
alter table ad_briefs add column if not exists posted_at timestamptz;
alter table ad_briefs add column if not exists instagram_post_id text;

-- ============================================================
-- Coupon codes — separate from the referral-code mechanism (which is
-- per-customer and rewards the referrer) and the discount_rules engine
-- (which is a single always-on "buy N get X% off" rule). A coupon is
-- admin-created, has its own code string, optional expiry and usage cap,
-- and every redemption is logged so "how many times, by who" is a real
-- query instead of a guess.
-- ============================================================
create table if not exists coupon_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null default 'flat', -- flat | percent
  discount_value numeric not null,
  expires_at timestamptz,
  usage_limit integer, -- null = unlimited
  times_used integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references coupon_codes(id),
  order_id uuid references orders(id),
  customer_phone text,
  customer_email text,
  discount_amount numeric not null,
  redeemed_at timestamptz not null default now()
);
create index if not exists coupon_redemptions_coupon_idx on coupon_redemptions (coupon_id);

alter table orders add column if not exists coupon_code_used text;
alter table orders add column if not exists coupon_discount_amount numeric not null default 0;

-- ============================================================
-- Manual expense log — the input side of a real P&L. Free-text category
-- rather than an enum since a solo operator's expense categories evolve
-- faster than a migration cycle; reporting can still group by whatever
-- categories are actually in use.
-- ============================================================
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category text not null,
  paid_by text not null,
  description text,
  amount numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists expenses_date_idx on expenses (expense_date desc);

-- ============================================================
-- Sales-signal ad briefs — auto-drafted (never auto-launched) when a
-- chapter is selling fast or has visibly cooled off week-over-week.
-- sales_signal + the guard query in lib/sales-signal-briefs.ts prevent
-- re-drafting the same chapter/signal every single day.
-- ============================================================
alter table ad_briefs add column if not exists auto_generated boolean not null default false;
alter table ad_briefs add column if not exists sales_signal text; -- selling_fast | cooling_off

-- ============================================================
-- Snapshot of a checkout's full payload, keyed by the Razorpay order it
-- started paying for — the Razorpay webhook's only way to actually create
-- the order if the customer's browser never makes it back to call /verify
-- (crashed tab, closed app, dropped connection right after paying). Rows
-- pile up harmlessly for successful checkouts too (the webhook just finds
-- the order already exists and no-ops) — cheap enough not to bother
-- cleaning up.
-- ============================================================
create table if not exists pending_orders (
  id uuid primary key default gen_random_uuid(),
  razorpay_order_id text not null unique,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Low-stock alert guard — one email per dip below the threshold, not one
-- per order. Reset back to false once restock brings it back above the
-- threshold, so the next dip alerts again.
-- ============================================================
alter table inventory add column if not exists low_stock_alerted boolean not null default false;

-- ============================================================
-- Content calendar: queueing a brief to auto-post/auto-launch at a future
-- time, plus editable ad-launch attributes (targeting, CTA) that used to be
-- hardcoded in lib/meta-ads.ts. The cron in app/api/cron/publish-queue
-- sweeps queue_status = 'queued' rows past their scheduled_for time.
-- ============================================================
alter table ad_briefs add column if not exists scheduled_for timestamptz;
alter table ad_briefs add column if not exists scheduled_action text; -- post | launch
alter table ad_briefs add column if not exists queue_status text not null default 'none'; -- none | queued | published | failed
alter table ad_briefs add column if not exists queue_error text;
alter table ad_briefs add column if not exists launched_at timestamptz;
alter table ad_briefs add column if not exists ad_cta_override text;
alter table ad_briefs add column if not exists ad_age_min int not null default 18;
alter table ad_briefs add column if not exists ad_age_max int not null default 65;
alter table ad_briefs add column if not exists ad_gender text not null default 'all'; -- all | male | female
alter table ad_briefs add column if not exists ad_daily_budget_rupees int not null default 500;

-- A multi-chapter carousel (one card per selected Chapter, instead of 4
-- angles on a single product) has no single chapter_slug — this array
-- carries the ordered list instead, one entry per carousel card.
alter table ad_briefs add column if not exists chapter_slugs text[];

-- Explicit marker for "the assets + static/carousel format decision has
-- been made" — a fresh single-chapter/generic brief starts with this null
-- so /admin/ad-briefs shows the asset-picker + format-choice step before
-- the full creative-editing UI, matching a real strategist's flow (brief
-- first, then pick source photos, then decide the format they call for).
-- A multi-chapter carousel brief is already carousel by construction and
-- sets this at creation, skipping the step entirely.
alter table ad_briefs add column if not exists creative_format text;
create index if not exists ad_briefs_queue_idx on ad_briefs (queue_status, scheduled_for);

-- Checkout no longer requires an email address — phone (WhatsApp) is the
-- primary contact channel and email is optional, so this can no longer be
-- not-null.
alter table orders alter column customer_email drop not null;

-- Real per-message failure reason from MSG91's delivery-status webhook (e.g.
-- "404 Invalid Flow") — MSG91's initial API response only ever says
-- "queued successfully" regardless of whether the Flow/template is actually
-- valid, so this is the only place a genuine failure reason ever surfaces.
alter table whatsapp_messages add column if not exists error_detail text;

-- Usage log for automatic discount_rules (e.g. "Buy 3, get 4th free") —
-- mirrors coupon_redemptions so /admin/discounts can show how many times a
-- rule has been used and by whom, the same way /admin/coupons already does
-- for coupon codes.
create table if not exists discount_rule_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_rule_id uuid references discount_rules(id),
  order_id uuid references orders(id),
  customer_phone text,
  customer_email text,
  discount_amount integer not null,
  redeemed_at timestamptz not null default now()
);
create index if not exists discount_rule_redemptions_rule_idx on discount_rule_redemptions (discount_rule_id);

-- Historical customer data imported from the pre-migration platform's xlsx
-- export (2023-2025 orders) — deliberately a separate table from `customers`,
-- since these people never signed up on the current site and most have no
-- matching `orders` row. One row per unique phone number (the xlsx is one
-- row per line item, deduped on import). last_order_status/last_order_at
-- drive win-back eligibility; total_delivered_orders is used to exclude
-- people whose only history is cancelled/failed/RTO'd orders.
create table if not exists legacy_customers (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  name text,
  email text,
  city text,
  state text,
  pincode text,
  first_order_at timestamptz,
  last_order_at timestamptz,
  last_order_status text,
  total_orders int not null default 0,
  total_delivered_orders int not null default 0,
  lifetime_value numeric not null default 0,
  winback_sent_at timestamptz,
  winback_link_token text unique,
  converted_order_id uuid references orders(id),
  created_at timestamptz not null default now()
);
create index if not exists legacy_customers_last_order_idx on legacy_customers (last_order_at);
create index if not exists legacy_customers_winback_token_idx on legacy_customers (winback_link_token);

-- One row per product line item per legacy customer — the actual purchase
-- history, kept separate from the aggregate legacy_customers row so
-- product-based targeting ("who has never bought the Ocean chapter") is a
-- straightforward join/anti-join instead of parsing a packed field.
create table if not exists legacy_customer_purchases (
  id uuid primary key default gen_random_uuid(),
  legacy_customer_id uuid not null references legacy_customers(id) on delete cascade,
  source_order_id text not null,
  product_name text not null,
  quantity int not null default 1,
  line_item_value numeric,
  status text,
  ordered_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists legacy_customer_purchases_customer_idx on legacy_customer_purchases (legacy_customer_id);
create index if not exists legacy_customer_purchases_product_idx on legacy_customer_purchases (product_name);

-- Friday-7pm drop pre-orders: a ₹500 deposit reserves a spot before any
-- product is actually listed. On drop night, admin hits "Notify All" in
-- /admin/preorders which emails every 'paid' row a heads-up + shop link and
-- stamps notified_at, so a second click never double-sends.
create table if not exists preorders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  chapter_slug text,
  amount_rupees numeric not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  razorpay_order_id text unique,
  razorpay_payment_id text,
  notified_at timestamptz,
  converted_order_id uuid references orders(id),
  created_at timestamptz not null default now()
);
create index if not exists preorders_status_idx on preorders (status);
create index if not exists preorders_email_idx on preorders (email);

-- ============================================================
-- 6 products were dropped from the launch catalogue (no photography), but
-- their inventory rows were seeded before that decision and were never
-- cleaned up — delete them so `inventory` matches the real 16 SKUs in
-- lib/chapters.ts exactly. Starting stock for the 16 real SKUs: 50 units
-- each.
-- ============================================================
delete from inventory where chapter_slug in (
  'moon-wayfarer-black',
  'moon-round-black',
  'moon-rectangle-black-grey',
  'moon-rectangle-black-green',
  'moon-aviator-classic-black-black',
  'moon-aviator-metal-silver-grey'
);

update inventory set stock_on_hand = 50 where chapter_slug in (
  'moon-wayfarer-black-green',
  'moon-wayfarer-demi-brown-light-brown',
  'moon-round-black-light-brown',
  'moon-round-demi-brown-blue-graded',
  'moon-rectangle-black-orange',
  'moon-rectangle-black-blue',
  'moon-rectangle-black-purple',
  'moon-aviator-classic-demi-brown-grey-graded',
  'moon-aviator-classic-black-yellow',
  'moon-octagon-silver-light-brown',
  'moon-octagon-gold-grey',
  'moon-octagon-silver-grey',
  'moon-octagon-black-blue',
  'moon-aviator-metal-black-yellow',
  'moon-aviator-metal-gunmetal-brown',
  'moon-aviator-metal-gold-green'
);

-- ============================================================
-- Admin-added products (via /admin/add-chapter) now carry their own model
-- photo (generated via Gemini image-to-image from the uploaded angle
-- shots, see lib/image-gen.ts generateModelPhoto) and which collection
-- they belong to — "core" (the everyday homepage lineup) or "limited"
-- (the Limited Series drop line at /limited-series). Defaults to "core" so
-- existing rows keep behaving exactly as before.
-- ============================================================
alter table dynamic_chapters add column if not exists model_image text;
alter table dynamic_chapters add column if not exists collection text not null default 'core' check (collection in ('core', 'limited'));

-- ============================================================
-- Master inventory: every supplier-sourced product becomes a
-- dynamic_chapters row immediately (via /admin/master-inventory or the
-- purchase-log import), whether or not it's shown on the site yet.
-- `live` gates visibility — getCoreCollectionChapters/getLimitedSeriesChapters
-- only return rows where live = true, so a product can sit in the backend
-- as a draft (photographed, price set, awaiting a model shot or a
-- decision) without ever reaching the public site. Defaults to false so
-- every newly-imported product starts as a draft, not published by
-- accident.
-- ============================================================
alter table dynamic_chapters add column if not exists live boolean not null default false;

-- ============================================================
-- Creator program: gifting/collab applications from Instagram creators.
-- Deliberately one table for "creator" and "application" — for a simple
-- gifting program these are the same real-world thing, not separate
-- entities, so this stays one row per creator rather than a creator/
-- application join. follower_count is picked up server-side via Instagram
-- Graph API Business Discovery at apply time (see getPublicFollowerCount in
-- lib/instagram.ts) — the brand's own connected account reading the
-- creator's PUBLIC stats by handle, never a per-creator OAuth/connect flow.
-- Falls back to 0 (with a note in score_reasons) if the account can't be
-- resolved, e.g. a personal rather than Business/Creator account.
-- score/score_reasons/recommendation are written once by the automated
-- evaluation agent (lib/creator-scoring.ts) right after apply; an admin
-- still makes the real approve/reject call in /admin/creators — the agent
-- only recommends. status is a simple controlled lifecycle (not a DB enum,
-- validated in lib/creators.ts): applied | approved | rejected |
-- agreement_sent | agreed | product_shipped | content_received | completed.
-- why_join is unused going forward (the apply form no longer asks it) —
-- left in place rather than dropped, since an unused nullable column costs
-- nothing and a handful of already-submitted rows may still have it set.
-- ============================================================
create table if not exists creators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  instagram_handle text not null,
  follower_count integer not null default 0,
  category text,
  city text,
  why_join text,
  status text not null default 'applied',
  score integer,
  score_reasons text[],
  recommendation text, -- approve | review | reject
  product_name text,
  product_shipped_at timestamptz,
  coupon_code text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists creators_status_idx on creators (status);
create unique index if not exists creators_instagram_handle_idx on creators (lower(instagram_handle));

-- One signed record per creator (a creator only ever signs once for the
-- simple single-agreement-per-creator flow this ships with — a real
-- multi-campaign system would key this per-campaign instead).
-- agreement_html is a snapshot of exactly what was shown/signed, so a
-- later edit to the live template never changes what an already-signed
-- creator agreed to. No third-party e-signature vendor — signed_name +
-- signer_ip + signed_at + the generated PDF at pdf_url together are the
-- full signed record.
create table if not exists creator_agreements (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  version text not null default 'v1',
  agreement_html text not null,
  signed_name text,
  signed_at timestamptz,
  signer_ip text,
  pdf_url text,
  created_at timestamptz not null default now()
);
create index if not exists creator_agreements_creator_idx on creator_agreements (creator_id);

-- Content a creator posted tagging/collaborating with the brand. Deliberately
-- NOT auto-discovered by scraping or polling third-party accounts — source
-- 'instagram_tags' rows come from the brand's OWN connected Instagram
-- account's tagged-media list (see getTaggedMedia in lib/instagram.ts,
-- which only ever reads media where the connected business account itself
-- is tagged/collaborator-added), picked up and linked to a creator by an
-- admin in /admin/creators. 'manual' rows are typed in directly when a post
-- is seen some other way (e.g. a Story mention, which the API can't list).
create table if not exists creator_content (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  platform text not null default 'instagram',
  post_url text,
  media_type text, -- feed | reel | story | tag
  caption text,
  likes integer,
  comments integer,
  reach integer,
  posted_at timestamptz,
  captured_at timestamptz not null default now(),
  source text not null default 'manual', -- manual | instagram_tags
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists creator_content_creator_idx on creator_content (creator_id);

-- ============================================================
-- "Pay With A Post" — a checkout payment method that isn't currency: a
-- shopper with a verified minimum follower count (via Instagram Business
-- Discovery, see getPublicFollowerCount in lib/instagram.ts — never a
-- self-reported number) gets the product against wearing it, posting a
-- photo, and adding the brand as a collaborator, but it only actually SHIPS
-- once their personal coupon code (barter_coupon_code, minted the same way
-- creator coupons are — see lib/post-barter.ts) has driven
-- barter_required_orders real, non-self redemptions — reusing the existing
-- coupon_codes/coupon_redemptions engine unchanged, not a parallel
-- attribution system. is_post_barter is a plain boolean flag (not a new
-- status) specifically so lib/pnl.ts can flag these — they count as real
-- revenue at full retail value like any other order, with the offsetting
-- cost booked as a "Pay With A Post (Marketing CAC)" expense line of the
-- same amount, rather than being quietly excluded from the top line.
-- ============================================================
alter table orders add column if not exists is_post_barter boolean not null default false;
-- gift_first (follower count >= threshold) ships immediately, on trust —
-- they post afterward. sell_first (below threshold, or unverifiable) is the
-- safer default: nothing ships until their code has driven
-- barter_required_orders real orders. Open to anyone either way — there is
-- no minimum to participate, only a tier, decided server-side in
-- lib/post-barter.ts's classifyPostBarterApplicant, never client-supplied.
alter table orders add column if not exists barter_tier text not null default 'sell_first';
alter table orders add column if not exists barter_instagram_handle text;
alter table orders add column if not exists barter_follower_count integer;
alter table orders add column if not exists barter_coupon_code text;
alter table orders add column if not exists barter_required_orders integer not null default 3;
alter table orders add column if not exists barter_post_url text;
alter table orders add column if not exists barter_qualified_at timestamptz;
create index if not exists orders_is_post_barter_idx on orders (is_post_barter) where is_post_barter;

-- Gift-first ships on trust with a binding, explicit condition: post within
-- 12 hours of delivery (see barter_charge_deadline_at, set from
-- delivered_at in lib/shiprocket-status.ts), or get charged full price via a
-- payment link (app/api/cron/barter-charge-sweep). barter_terms_accepted_at
-- is the shopper's checkout-time acceptance of that condition — captured
-- only for gift_first, since sell_first never ships before a post exists.
alter table orders add column if not exists barter_terms_accepted_at timestamptz;
alter table orders add column if not exists barter_charge_deadline_at timestamptz;
alter table orders add column if not exists barter_charge_link_sent_at timestamptz;
alter table orders add column if not exists barter_charged_at timestamptz;
