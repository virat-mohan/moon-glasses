# WHITELABEL_INVENTORY — Moonglasses (D2C Storefront)

Read-only audit for turning this codebase into a white-labelled base for DevShop Retail OS. No code was changed. Only setting/env-var **names** are listed below, never values.

---

## 1. FEATURE INVENTORY

### Storefront

| Feature | Routes/pages | Key lib files | DB tables | What it does | Classification |
|---|---|---|---|---|---|
| Product catalog browsing | `app/page.tsx`, `app/limited-series/page.tsx`, `components/collection/*`, `components/globe/ExploreGlobe.tsx` | `lib/chapters.ts`, `lib/chapters-dynamic.ts`, `lib/limited-series.ts`, `lib/series.ts` | `dynamic_chapters`, `chapter_hero_overrides` | Homepage grid + style/shape-based grouping of products | CORE (current implementation is category-naming-specific) |
| Product detail page | `app/chapter/[slug]/page.tsx`, `components/chapter/Product360Viewer.tsx` | `lib/chapters*.ts`, `lib/craftsmanshipPins.ts`, `lib/reviews.ts` | — | Single-product page: gallery, story, reviews, craftsmanship badges | CORE |
| Virtual try-on | `app/try-on/page.tsx`, `components/tryOn/TryOnCamera.tsx` | — | — | Camera-based virtual try-on overlay | CATEGORY-SPECIFIC (eyewear only) |
| Cart | `app/cart/page.tsx` | `lib/cart.tsx`, `lib/cart-deep-link.ts` | `cart_sessions` | Client cart state + shareable cart deep links + abandonment tracking | CORE |
| Checkout (multi-payment) | `app/checkout/page.tsx`, `app/checkout/confirmed/page.tsx` | `lib/order-pricing.ts`, `lib/order-fulfillment.ts`, `lib/razorpay.ts`, `lib/paytm.ts`, `lib/upi-payment.ts` | `orders`, `order_items`, `pending_orders` | Trusted server-side pricing + one of Razorpay/Paytm/raw UPI QR/manual-WhatsApp-fallback payment | CORE (individual gateways are swappable MODULEs) |
| Customer account (OTP login, addresses, referral) | `app/account/page.tsx`, `app/api/account/*`, `app/api/auth/*` | — | `customers`, `customer_addresses`, `otp_codes`, `customer_sessions` | Phone/email OTP login, saved addresses, own referral code | CORE |
| Loyalty program ("Miles"/"Good Vibes") | — | `lib/loyalty.ts` | `loyalty_ledger` | Earn-per-unit / redeem-at-threshold points ledger | MODULE (default ON, name/rates must be brand-configurable) |
| Referrals | `app/api/orders/[id]/refer`, `app/api/account/refer` | `lib/referrals.ts` | `referrals` | Flat discount to new customer + loyalty reward to referrer | MODULE |
| Coupons | `app/api/checkout/coupon-preview` | `lib/coupons.ts` | `coupon_codes`, `coupon_redemptions` | Admin-issued flat/percent codes | CORE |
| Discount rules engine | `app/api/discount-rules` | `lib/discounts.ts` | `discount_rules`, `discount_rule_redemptions` | "Buy N, cheapest at X% off" cart-wide promo | MODULE |
| "Pay With A Post" barter payment | `app/barter/[orderId]/*`, `app/api/checkout/post-barter/*`, `components/ui/PayWithAPostMark.tsx` | `lib/post-barter.ts` | `orders` (barter_* columns) | Ships product free in exchange for an Instagram post + referral-driven coupon redemptions | MODULE (matches `payWithAPost` flag; a genuinely bespoke mechanic) |
| Preorder / scheduled drop | `app/preorder/page.tsx` | `lib/preorders.ts`, `lib/dropDate.ts` | `preorders` | Deposit-based reservation ahead of a scheduled launch date | MODULE (matches `preorder` flag) |
| Reviews | `app/review/[orderId]/page.tsx`, `components/reviews/ReviewForm.tsx` | `lib/reviews.ts` | `reviews` | Post-delivery product reviews | CORE |
| Returns | — | `lib/returns.ts` | `return_requests`, `order_events` | Customer-initiated return request + refund calc by reason | CORE |
| Restock notify | `components/chapter/RestockNotifyForm.tsx`, `app/api/restock-notify` | — | — | Email/WhatsApp opt-in for out-of-stock items | MODULE |
| Newsletter | `app/api/newsletter/subscribe` | `lib/email.ts` | `newsletter_subscribers`, `journal_newsletter_sends` | Signup + per-article send log | MODULE |
| Journal / blog | `components/journal/*` | `lib/journal.ts`, `lib/journal-dynamic.ts` | `journal_articles` | Static + AI-drafted magazine-style content section | MODULE (matches `journal` flag) |
| Community / Explorer UGC wall | `components/collection/CollectionExplorer.tsx`, `app/api/community/submit` | `lib/community.ts` | `explorer_submissions` | Customer photo/testimonial submission wall | MODULE (not in the given flag list — gap to add) |
| Creators / gifting program | `app/api/creators/*` | — | `creators`, `creator_agreements`, `creator_content` | Influencer product-gifting + content-tracking program | MODULE (matches `creators` flag) |
| Contact form | `app/contact/page.tsx`, `app/api/contact` | — | — | General inquiry lead capture | CORE |
| WhatsApp customer inbox (2-way) | `app/api/webhooks/msg91-whatsapp-inbound` | `lib/whatsapp-inbox.ts` | `whatsapp_conversations`, `whatsapp_conversation_messages` | Logs inbound WhatsApp messages into an admin-viewable conversation thread | MODULE (WhatsApp default ON) |
| WhatsApp payment auto-confirm | — | `lib/payment-auto-confirm.ts`, `lib/payment-screenshot.ts` | `whatsapp_payment_confirmations` | Vision-reads a UPI screenshot, auto-confirms only on phone+amount+UTR triple-match | MODULE |
| Tracking / analytics (first-party + Meta) | — | `lib/tracking.ts`, `lib/client-tracking.ts`, `lib/website-analytics.ts`, `lib/meta-conversions.ts` | `tracking_events` | Funnel/session/attribution tracking, mirrored server-side to Meta Conversions API | CORE |
| Policy pages | `app/terms`, `app/privacy`, `app/refund-policy`, `app/shipping-policy` | — | — | Legal/policy content | CORE (mechanism), content is brand-specific |

### Admin

| Feature | Routes/pages | Key lib files | DB tables | What it does | Classification |
|---|---|---|---|---|---|
| Orders management | `app/admin/orders/*` and its API routes (list/manual/mark-upi-paid/ship/refund/cancel/sync-payment/track/print-labels/return-pickup) | `lib/order-fulfillment.ts`, `lib/order-shipping.ts` | `orders`, `order_items` | Full order lifecycle management | CORE |
| Catalog/inventory admin | `app/admin/inventory`, `master-inventory`, `add-chapter`, `edit-chapter`, `product-images`, `models` | `lib/inventory.ts`, `lib/image-gen.ts`, `lib/chapters-dynamic.ts` | `inventory`, `dynamic_chapters`, `chapter_hero_overrides`, `marketing_assets` | Add/edit products, stock, photos; AI model-photo generation | CORE (AI photo-gen is MODULE) |
| Logistics / Shipments & RTO | `app/admin/logistics`, `app/api/webhooks/courier-status` | `lib/shiprocket.ts`, `lib/shiprocket-status.ts` | `orders` (shipment fields), `order_events` | Courier rate/label/tracking/RTO handling | CORE mechanism; Shiprocket itself is a swappable MODULE |
| Return requests admin | `app/admin/returns` | `lib/returns.ts` | `return_requests` | Approve/deny/refund returns | CORE |
| Customers & loyalty admin | `app/admin/customers`, `customers/import` | `lib/loyalty.ts` | `customers`, `loyalty_ledger`, `legacy_customers`, `imported_customer_records` | Customer list, VIP tagging, legacy data import | CORE (import tooling is BRAND-ONLY, see §8) |
| Leads | `app/admin/leads` | — | `leads`, `bot_conversations` | CRM leads from guest checkout + Meta DM/comment bot | MODULE |
| Discounts & coupons admin | `app/admin/discounts`, `app/admin/coupons` | `lib/discounts.ts`, `lib/coupons.ts` | `discount_rules`, `coupon_codes` | Manage promo rules and codes | MODULE |
| Expenses & P&L (actuals) | `app/admin/expenses`, `app/admin/pnl` | `lib/pnl.ts` | `expenses`, `orders` | Real month-to-date P&L from actual orders/expenses | CORE |
| Business Plan (AI forecast P&L) | `app/admin/business-plan` | `lib/business-plan.ts`, `lib/business-plan-calc.ts` | `business_plans` | AI-researched, driver-based 3-month benchmark P&L, editable | CORE (per brief's default-on list) |
| Website analytics admin | `app/admin/analytics` | `lib/website-analytics.ts` | `tracking_events` | Funnel/session/revenue reporting | CORE |
| Ad Brief Generator / Content Calendar / Ad Agent | `app/admin/ad-briefs`, `content-calendar`, `agent-log` | `lib/ad-brief.ts`, `lib/ad-agent.ts`, `lib/meta-ads.ts`, `lib/meta-insights.ts` | `ad_briefs`, `agent_actions` | AI-drafted Meta ad creative/copy, scheduling, and an autonomous budget-scaling agent (paused-campaign-only, human must activate spend) | MODULE (not in given flag list — gap to add as e.g. `metaAdsAgent`) |
| Journal Draft Generator | `app/admin/journal-drafts` | `lib/claude.ts` | `journal_drafts` | AI-drafted blog articles | MODULE (tied to `journal` flag) |
| Newsletter admin | `app/admin/newsletter` | `lib/email.ts` | `newsletter_subscribers` | Compose/send newsletter drops | MODULE |
| Abandoned carts admin + nudge | `app/admin/abandoned-carts`, cron `abandon-sweep` | `lib/cart.tsx`/`cart-session-convert` | `cart_sessions` | Detects stale carts, sends WhatsApp/email nudge sequence | CORE |
| Growth reports (AI recommendations) | `app/admin/reports` | `lib/growth-recommendations.ts` | `weekly_reports` | AI-generated weekly growth suggestions from real funnel/ad data | MODULE |
| Pay With A Post admin | `app/admin/post-barter` | `lib/post-barter.ts` | `orders` (barter_*) | Manage barter-tier orders, mark-charged sweep | MODULE (matches `payWithAPost`) |
| Preorders (drop) admin | `app/admin/preorders` | `lib/preorders.ts` | `preorders` | Manage deposit preorders ahead of a drop | MODULE (matches `preorder`) |
| Creators / Explorer / Reviews admin | `app/admin/creators`, `explorer-submissions`, `reviews` | — | `creators`, `explorer_submissions`, `reviews` | Approve creator applications, moderate UGC wall, moderate reviews | MODULE / MODULE / CORE |
| WhatsApp payment confirmations admin | `app/admin/payment-confirmations` | `lib/payment-auto-confirm.ts` | `whatsapp_payment_confirmations` | Human review queue for ambiguous auto-confirm attempts | MODULE |
| Marketing assets library | `app/admin/marketing-assets` | — | `marketing_assets` | Reusable photo library for ad creative | MODULE |
| Brand Profile admin | `app/admin/brand-profile` | `lib/brand.ts` | `app_settings` (`BRAND_PROFILE` key) | Edits name/tagline/voice/productNoun/visualLanguage — becomes `brand.config.ts`'s runtime-editable subset in the template | CORE |
| Settings (credentials) admin | `app/admin/settings` | `lib/settings.ts` | `app_settings` | Every integration credential and business-rule setting, keyed by name | CORE |

### Background jobs, crons, webhooks, AI agents

| Feature | Routes/pages | Key lib files | DB tables | What it does | Classification |
|---|---|---|---|---|---|
| Cron: abandon-sweep (daily) | `app/api/cron/abandon-sweep` | — | `cart_sessions` | Marks stale carts abandoned, triggers nudge sequence | CORE |
| Cron: ad-agent (daily) | `app/api/cron/ad-agent` | `lib/ad-agent.ts` | `agent_actions` | Autonomous Meta ad-budget scaling (up only, capped) | MODULE |
| Cron: winback (daily) | `app/api/cron/winback` | — | `customers` | Lapsed-customer win-back nudges | CORE |
| Cron: sales-signal-briefs (weekly) | `app/api/cron/sales-signal-briefs` | `lib/sales-signal-briefs.ts` | `ad_briefs` | Auto-drafts ad briefs for fast-selling/cooling products | MODULE |
| Cron: ops-digest (daily) | `app/api/cron/ops-digest` | `lib/ops-digest.ts` | — | Daily ops summary | CORE |
| Cron: publish-queue (daily) | `app/api/cron/publish-queue` | — | `ad_briefs` | Publishes/launches scheduled ad briefs | MODULE |
| Cron: track-sweep (daily) | `app/api/cron/track-sweep` | `lib/tracking.ts` | `tracking_events` | Analytics event rollup | CORE |
| Cron: barter-charge-sweep (hourly) | `app/api/cron/barter-charge-sweep` | `lib/post-barter.ts` | `orders` | Charges gift-first barterers who missed the 12h post deadline | MODULE |
| Webhook: Razorpay | `app/api/webhooks/razorpay` | `lib/razorpay.ts` | `orders`, `pending_orders` | Payment capture/refund reconciliation | MODULE |
| Webhook: Meta (IG/FB DM + comments) | `app/api/webhooks/meta` | `lib/meta-bot.ts` | `bot_conversations`, `leads` | Inbound DM/comment auto-reply bot (untested against live approved app, see §8) | MODULE |
| Webhook: MSG91 (delivery receipts) | `app/api/webhooks/msg91` | `lib/whatsapp-notify.ts` | `whatsapp_messages` | Delivered/read status for outbound WhatsApp sends | MODULE |
| Webhook: MSG91 (inbound WhatsApp) | `app/api/webhooks/msg91-whatsapp-inbound` | `lib/whatsapp-inbox.ts`, `lib/payment-auto-confirm.ts` | `whatsapp_conversations`, `whatsapp_payment_confirmations` | Inbound message logging + payment-screenshot auto-confirm trigger | MODULE |
| Webhook: Shiprocket courier-status | `app/api/webhooks/courier-status` | `lib/shiprocket-status.ts` | `orders`, `order_events` | NDR/RTO/delivered status updates, customer nudges | MODULE |
| AI: ad-brief / journal-draft / growth-recommendations / business-plan generators | admin pages above | `lib/ad-brief.ts`, `lib/claude.ts`, `lib/growth-recommendations.ts`, `lib/business-plan.ts` | respective tables | Each a standalone Claude API call producing structured content/drivers | MODULE, each independently |
| AI: payment-screenshot verifier | — | `lib/payment-screenshot.ts` | `whatsapp_payment_confirmations` | Vision extraction of amount/UTR/payee from a screenshot | MODULE |

---

## 2. BRAND TERMINOLOGY

*Note: `lib/brand.ts` already contains a partial `BrandProfile` config (`brandName`, `tagline`, `voice`, `productNoun`, `currencySymbol`, `siteUrl`, `instagramHandle`, `visualLanguage`), but its values are hardcoded and the same strings are duplicated as literals elsewhere instead of importing from it.*

| Term | Where (files, count) | What it means | Generic config key to replace it with |
|---|---|---|---|
| "MOON GLASSES" / "Moonglasses" / "moon-glasses.store" | 32 files, e.g. `lib/brand.ts`, `app/layout.tsx`, `lib/business-plan.ts`, `app/privacy/page.tsx`, `package.json` | The brand name itself | `brandName` (exists, inconsistently imported) |
| "@moonglassesonline" | 2 files: `app/layout.tsx`, `lib/brand.ts` | Instagram handle | `instagramHandle` (exists) |
| "See A Brighter You" | 4 files: `app/layout.tsx`, `app/about/page.tsx`, `components/checkout/ShareToInstagramButton.tsx`, `lib/brand.ts` | Brand tagline | `tagline` (exists) |
| "sunglasses" (productNoun) | 20 files | Product category word in copy/prompts | `productNoun` (exists singular-only; needs plural too) |
| "eyewear" | 5 files | Synonym for product category | fold into `productNoun` usage |
| "lens" | 9 files, e.g. `types/chapter.ts`, `app/admin/add-chapter/page.tsx` | Product attribute (tint/color) | `productAttributeLensLabel` |
| "frame" | 14 files | Product attribute (material/style) | `productAttributeFrameLabel` |
| "tint" | 8 files | Product attribute (lens color) | `productAttributeTintLabel` |
| "Chapter" / "Chapters" | 118 files — the core product noun throughout (type name, route segment, DB concept, UI copy) | What a single SKU/product unit is called everywhere | `productUnitNounSingular` / `productUnitNounPlural` |
| "capsBought" (internal var name) | 6 files: `app/api/orders/route.ts`, `app/api/admin/orders/manual/route.ts`, `lib/invoice.ts`, `lib/loyalty.ts`, `lib/upi-payment.ts`, `lib/order-fulfillment.ts` | Leftover naming inconsistency, counts units for loyalty earning | internal rename only, no config key |
| "Miles" | 14 files, e.g. `lib/loyalty.ts` (`getMilesBalance`, `MILES_PER_CAP`, `MILES_REDEMPTION_THRESHOLD`) | Internal/code name for the loyalty unit | `loyaltyUnitName` |
| "Good Vibes" | 17 files, e.g. `app/account/page.tsx`, `lib/email.ts`, `app/admin/pnl/page.tsx` | Customer-facing loyalty currency name | `loyaltyProgramDisplayName` |
| "Pay With A Post" / `PayWithAPostMark` | 30 files | Name of the barter/creator-payment mechanic | `barterMechanicName` |
| "Gift First" / "Sell First" | 18 files | The two barter-payment tiers | `barterTierHighTrustName` / `barterTierStandardName` |
| "Explorer" / "Explore Globe" | 17 files, e.g. `lib/community.ts`, `components/collection/CollectionExplorer.tsx` | Named UGC discovery feature | `communityFeatureName` |
| "Journal" | 15 files, e.g. `lib/journal.ts`, `components/journal/MagazineReader.tsx` | Blog/magazine section name (also "Magazine" in component names) | `blogSectionName` |
| "Series" / "Plastic" / "Metal" / "Limited Series" | 14 files, e.g. `types/chapter.ts` | Product-line taxonomy: two materials + a "Limited Series" collection tier | `productSeriesNames`, `limitedCollectionName` |
| "Drop" / `DROP_DATE_ISO` | 8 files: `lib/dropDate.ts` + consumers | Launch/release-date terminology | `dropTerminologyName` (or generalize to `launchDate`) |
| "Craftsmanship" (Pins) | 3 files: `lib/craftsmanshipPins.ts`, `app/chapter/[slug]/page.tsx` | Named quality-badge section on PDP | `qualityBadgeSectionName` |
| WhatsApp support number (hardcoded, **two different numbers**) | 4 files: `app/checkout/page.tsx` (918800339125), `components/contact/WhatsAppFloatButton.tsx` (918800339125), `app/barter/[orderId]/pay/page.tsx` (919999277240), `app/checkout/confirmed/page.tsx` (919999277240) | Support/business WhatsApp deep links | `supportWhatsAppNumber` — also fix the inconsistency itself |
| Support email (hardcoded) | 5 files: policy pages + `lib/email.ts` | `hello@moon-glasses.store`, plus `orders@moon-glasses.store` sender | `supportEmail` / `ordersFromEmail` |
| Placeholder support phone | 4 policy pages | Literal `+91 00000 00000`, never filled in | `supportPhoneNumber` |
| Order notification recipient | `lib/email.ts` | Hardcodes a personal developer email alongside the support address | `orderNotificationRecipients` |
| Site domain (hardcoded, duplicated) | 13 files besides `lib/brand.ts`, plus a **second** hardcoded `SITE_URL` constant in `app/layout.tsx` | Canonical domain, defined in two places that must be kept in sync manually | `siteUrl` (single source of truth) |

---

## 3. BUSINESS RULES & NUMBERS

| Key or constant | Current value | Where | What it controls | Who decides for a new brand |
|---|---|---|---|---|
| Product prices | 1499 (Plastic), 1999 (Metal) | `lib/chapters.ts` (per-product), `app/admin/add-chapter/page.tsx`, `lib/shopify-import.ts` fallback | The only two retail price points that exist | BRAND |
| Limited Series pricing (unused) | Plastic 1749, Metal 2149 | `lib/limited-series.ts` | Price tier for an empty product line | BRAND |
| `dynamic_chapters.price` default | 1399 | `supabase/schema.sql` | Fallback default before a new admin product's price is set | DEVSHOP |
| `MILES_PER_CAP` | default 250 | `lib/settings.ts`; `lib/loyalty.ts` `earnMilesForOrder` | Loyalty earn rate per unit | TOGETHER |
| `MILES_REDEMPTION_THRESHOLD` | default 500 | `lib/settings.ts`; `lib/loyalty.ts` | Miles per redemption "block" | TOGETHER |
| `MILES_REDEMPTION_VALUE_RUPEES` | default 200 | `lib/settings.ts`; `lib/loyalty.ts` | Rupee value of one redemption block | TOGETHER |
| Loyalty redemption cap | `blocks = floor(balance/threshold)`, `maxRedeemable = blocks × value` | `lib/loyalty.ts` | Caps Miles usable per order, server-recomputed | DEVSHOP mechanism / TOGETHER rates |
| `REFERRAL_DISCOUNT_RUPEES` | default 200 | `lib/settings.ts`; `lib/referrals.ts` | New-customer referral discount | TOGETHER |
| `REFERRAL_REWARD_MILES` | default 500 | `lib/settings.ts`; `lib/referrals.ts` | Referrer's loyalty reward | TOGETHER |
| Referral eligibility rules | No self-referral; only valid on a customer's first order | `lib/referrals.ts` | Anti-abuse logic | DEVSHOP |
| Discount rule seed | "Buy 3, cheapest at 50% off," always active | `supabase/schema.sql` seed; `lib/discounts.ts` engine | The one always-on bulk promo | TOGETHER (margin-affecting) |
| Coupon engine | Admin-created, flat or %, optional expiry/cap | `lib/coupons.ts` | Ad hoc coupon codes | DEVSHOP mechanism / BRAND-TOGETHER per code |
| `COD_ADVANCE_AMOUNT_RUPEES` | default 200 | `lib/settings.ts`; `lib/order-pricing.ts` | Mandatory COD upfront advance (RTO mitigation) | TOGETHER |
| Shipping charge | Live Shiprocket rate pass-through, `Math.ceil`; `post_barter` always ₹0 | `lib/order-pricing.ts`, `lib/shiprocket.ts` | Real per-order shipping cost | DEVSHOP mechanism |
| Free shipping threshold | **None** — explicitly removed; every prepaid/COD order pays real rate | `lib/order-pricing.ts` (comment confirms removal) | N/A today | TOGETHER if reintroduced |
| `UNIT_WEIGHT_KG` | 0.2 kg | `lib/shiprocket.ts` | Per-unit shipping weight sent to courier API | BRAND (physical product property) |
| `BOX_DIMENSIONS_CM` | 25×20×10 | `lib/shiprocket.ts` | Package dimensions sent to courier API | BRAND |
| `LOW_STOCK_THRESHOLD_UNITS` | default 10 | `lib/settings.ts`; `lib/inventory.ts` | "Selling fast" badge + low-stock alert trigger | DEVSHOP |
| `POST_BARTER_MIN_FOLLOWERS` | default 5000 | `lib/settings.ts`; `lib/post-barter.ts` | Threshold for "gift_first" (ship-on-trust) tier | TOGETHER |
| `POST_BARTER_REQUIRED_ORDERS` | default 3 | `lib/settings.ts`; `lib/post-barter.ts`; also an `orders` column default | Real redemptions needed before a "sell_first" order ships | TOGETHER |
| `POST_BARTER_FRIEND_DISCOUNT_RUPEES` | default 0 | `lib/settings.ts`; `lib/post-barter.ts` | Friend discount via barter code (currently none — attribution only) | TOGETHER |
| `POST_BARTER_GIFT_FIRST_DAILY_CAP` | default 10 | `lib/settings.ts`; `lib/post-barter.ts` | Daily cap on ship-on-trust orders | TOGETHER |
| Gift-first post deadline | 12 hours post-delivery | `lib/post-barter.ts`, `lib/shiprocket-status.ts` | Deadline before an un-posted order is charged full price | TOGETHER |
| Ownership-proof verification window | 15 minutes | `lib/post-barter.ts` | Validity of an Instagram bio-code proof | DEVSHOP |
| `DROP_DATE_ISO` | default: next Friday 19:00 IST, computed | `lib/settings.ts`; `lib/dropDate.ts` | Preorder drop date/time shown to customers | BRAND |
| `PREORDER_AMOUNT_RUPEES` | default 500 | `lib/settings.ts`; `lib/preorders.ts` | Deposit to reserve a preorder spot | TOGETHER |
| `RETURN_WINDOW_DAYS` | default 3 | `lib/settings.ts`; `lib/returns.ts` | Days post-delivery to request a return | TOGETHER |
| Return refund policy | Defect = full refund incl. shipping; wrong-size = subtotal only, shipping forfeited | `lib/returns.ts` | Refund calc by reason | DEVSHOP mechanism / TOGETHER (shipping-refund choice) |
| `WINBACK_AFTER_DAYS` | default 60 | `lib/settings.ts` | Inactivity threshold for win-back eligibility | TOGETHER |
| `VIP_MIN_SPEND_RUPEES` | default 5000 | `lib/settings.ts` | Lifetime-spend VIP threshold | BRAND |
| `VIP_MIN_ORDERS` | default 3 | `lib/settings.ts` | Order-count VIP threshold | BRAND |
| `AGENT_ENABLED` | boolean, no default | `lib/settings.ts` | Master switch for the autonomous ad-budget agent | TOGETHER |
| `AGENT_MAX_DAILY_BUDGET_RUPEES` | default ₹1000/day | `lib/settings.ts`; `lib/ad-agent.ts` | Hard cap the agent can scale spend to | TOGETHER |
| Ad-agent scaling rule | Scales up only, never down; based on 3-day trailing ROAS/click signal | `lib/ad-agent.ts` | Autonomous budget policy | DEVSHOP mechanism |
| `ad_briefs.ad_daily_budget_rupees` default | 500 | `supabase/schema.sql` | Default per-brief ad budget | TOGETHER |
| `ad_briefs.ad_age_min/max` | 18 / 65 | `supabase/schema.sql` | Default Meta ad audience age range | BRAND |
| `ad_briefs.ad_gender` | default 'all' | `supabase/schema.sql` | Default Meta ad audience gender | BRAND |
| `COGS_PER_UNIT_RUPEES` | setting, no literal default | `lib/settings.ts` | Per-unit cost basis for P&L | BRAND |
| MSG91_* group (11+ keys: template IDs per event, auth key, integrated number, namespace, cost/message) | credentials/IDs | `lib/settings.ts`, `lib/msg91.ts` | WhatsApp/SMS provider config | DEVSHOP (infra, reconfigured per brand) |
| META_* group (access token, ad account, page, IG business account, pixel, webhook verify token, WhatsApp Cloud token/phone-number-id/language) | credentials only | `lib/settings.ts` | Meta/Instagram/WhatsApp Cloud integration | DEVSHOP |
| RAZORPAY_*, PAYTM_* group | credentials only | `lib/settings.ts` | Payment gateway credentials | DEVSHOP |
| SHIPROCKET_* group (email, password, pickup location/pincode, webhook token, token cache) | credentials/config | `lib/settings.ts` | Courier integration + warehouse pickup location | DEVSHOP creds / BRAND (which warehouse) |
| ANTHROPIC_API_KEY, OPENAI_API_KEY, IMAGE_GEN_API_KEY | credentials only | `lib/settings.ts` | AI generation providers | DEVSHOP |
| CRON_SECRET | credential | `lib/settings.ts` | Auth for Vercel cron endpoints | DEVSHOP |
| WAREHOUSE_EMAIL, WAREHOUSE_WHATSAPP_NUMBERS | contact info | `lib/settings.ts` | Where fulfillment notifications go | BRAND |
| UPI_ID, UPI_QR_IMAGE_URL, UPI_PAYEE_NAME | brand's own UPI details | `lib/settings.ts` | Manual UPI QR payment collection | BRAND |
| Hardcoded WhatsApp support number `919999277240` (and a second, different, also-hardcoded number `918800339125`) | literal | `app/barter/[orderId]/pay/page.tsx`, `app/checkout/confirmed/page.tsx`, `app/checkout/page.tsx`, `components/contact/WhatsAppFloatButton.tsx` | "Chat with us" deep links — inconsistent between two numbers, and not settings-driven at all | BRAND — real white-labelling gap |
| Return reasons enum | `['defect', 'wrong_size']` — "changed my mind" explicitly excluded | `lib/returns.ts` | Eligible return reasons | TOGETHER (margin-affecting policy stance) |
| Crons (8 total, schedules) | see §1 table | `vercel.json` | Scheduled job timing | DEVSHOP |

---

## 4. BRAND ASSETS & CONTENT

| Asset | Where | Must be replaced / can be generated / generic already |
|---|---|---|
| Logo files | `public/images/brand/moon-glasses-logo.png`, `moonglasses-logo.svg`, `-mono-white.png`, `-email-v2.png` | Must be replaced — paths hardcoded across `lib/email.ts`, `lib/invoice.ts`, `app/layout.tsx`. **Also found: leftover, unused "Travaholic" logo/sketch assets in the same folder** (`Travaholic logo.png`, `travaholic-logo-color-*.png`, `travaholic-wordmark-*.png`, plus unrelated sketch files) — dead files from a prior brand pivot, prune during white-labelling, don't migrate |
| Favicon | `app/favicon.ico` | Must be replaced |
| Product images | `public/images/chapters/<slug>/`, 29 product folders, naming convention `moon-<shape>-<material/color>-<lens-color>`; also `craft/`, `craftsmanship/`, `lifestyle/`, `patches/`, `map-pins/`, `globe/`, `team/` | Must be replaced/re-shot per brand's real catalogue (largest asset category). Model/lifestyle photos **can be generated** via the existing `lib/image-gen.ts` Gemini image-to-image pipeline from real product cutouts. Folder-naming convention is reusable |
| Fonts | `app/layout.tsx` via `next/font/google`: Inter (body), Space Grotesk (headings), Bodoni Moda (reserved for the "Pay With A Post" wordmark) | Generic already — swap the font imports + `globals.css` `@theme inline` mapping |
| Colors / design tokens | `app/globals.css` `:root` — `--moon-black/ink/white/paper/muted/line`, `--moon-gold`/`-soft` (sole accent), `--lens-blue/pink/green/peach` (UI accents echoing lens tints); zero border-radius is a deliberate brand rule; a legacy `--color-cream/ink/tan-gold` alias layer exists "so existing components resolve without a full rename pass" | Must be replaced per brand, but the token *architecture* (semantic aliases + Tailwind v4 `@theme inline`) is reusable. `lib/brand.ts`'s `visualLanguage` (AI image-gen prompt text) hardcodes this same palette description and must be rewritten too |
| Homepage/hero copy | `app/page.tsx`, `components/hero/HeroVideo.tsx`, `app/about/page.tsx` | Must be replaced — extensive hardcoded strings ("Light Tints. Big Mood.", "Made For After Dark", "Fashion First", "UV400 Protected", "Plastic Or Metal" with baked-in pricing, founder bio/photo, a pull-quote). **Not** settings-driven — editing the Brand Profile in admin would NOT change any of this, a real inconsistency |
| Journal/blog seed content | `lib/journal.ts` | Categories are pure travel-blog ("Road Trips," "Weekend Escapes," "Camping," "Coffee," "Travel Guides," "Playlists," "Packing Lists") and articles are framed as travel-magazine "Issues" (Issue No. 01 "First Light," etc.) — strong evidence this codebase pivoted from an earlier travel/exploration brand concept. The entire "Chapters/Journal/Explorer" conceptual framing is brand narrative, not generic commerce plumbing — must be replaced, not just re-skinned |
| Journal — dynamic layer | `lib/journal-dynamic.ts` | Architecture (merge static + admin-published `journal_articles`) is reusable; seed content must be replaced/emptied |
| Policy pages | `app/terms`, `app/privacy`, `app/refund-policy`, `app/shipping-policy` | Must be replaced — hardcoded business name, a real-looking physical address, an **unfilled GSTIN placeholder** ("add in Admin Settings"), an **unfilled phone placeholder** ("+91 00000 00000"), and domain references. Plain JSX strings, not settings-driven |
| Email templates | `lib/email.ts` (~25 `send*Email` functions) | Mixed: most bodies use `getBrandProfile()` for name/URL dynamically, but sender identity, logo URL, `ORDER_NOTIFICATION_RECIPIENTS` (includes a personal email), a hardcoded Google review link, several bodies' baked-in pricing copy, and the "Moonglasses Good Vibes" loyalty name are all hardcoded, not settings-driven |
| WhatsApp templates | `lib/whatsapp-notify.ts` | 12+ distinct template events (order_confirmation, ship_notification, abandoned_cart, restock_alert, review_request, ndr_nudge, rto_initiated, rto_refunded, referral_invite, winback, legacy_winback, buynow10_nudge), each backed by its own `MSG91_*_TEMPLATE_ID` setting. Three return-related settings (`MSG91_RETURN_APPROVED/DENIED/REFUNDED_TEMPLATE_ID`) exist but aren't wired to any actual send call — dead config. Approved template copy is not portable between brands/providers — each must be resubmitted and re-approved |
| Invoice layout | `lib/invoice.ts` | Hardcoded business name, address, logo, unfilled GSTIN text, hardcoded product-noun "Sunglasses" (not `brand.productNoun`), hardcoded loyalty program name. Must be replaced/parameterized |
| SEO / meta | `app/layout.tsx` | Hardcoded title template, description, keywords, OG/Twitter images, a **second, separate** hardcoded `SITE_URL` constant (must be kept in sync with `lib/brand.ts`'s `siteUrl` manually), and a hardcoded `organizationJsonLd` schema block. OG image generation exists for order-confirmation cards only (`@vercel/og`), not generic page social-share images |
| **Architecture gap to flag** | `lib/brand.ts` | Only `BrandProfile` (name/tagline/voice/productNoun/siteUrl/instagramHandle/visualLanguage) is genuinely settings-driven, and it's only consumed by the AI-generation pipeline — not by the homepage, about page, policy pages, invoice, or most of `email.ts`. This is the single biggest structural gap for white-labelling: editing the Brand Profile today does not change what customers actually see on most pages |

---

## 5. INTEGRATIONS & CREDENTIALS

| Service | Env vars / settings keys | What it's used for | Setup steps for a new brand | Automatable or needs a human |
|---|---|---|---|---|
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Card/UPI/netbanking checkout + refunds + webhook reconciliation. **Currently hard-disabled** via a code constant (`RAZORPAY_DISABLED = true` in `app/api/checkout/config/route.ts`), not a setting | Business account + KYC, generate live keys, set webhook, save settings, flip the disable flag (currently requires a code change, not just a setting) | Account/KYC = human. API calls automatable once keys exist |
| Paytm | `PAYTM_MID`, `PAYTM_MERCHANT_KEY`, `PAYTM_ENVIRONMENT` | Alternative prepaid gateway; own AES-128-CBC checksum scheme; Transaction Status API is the real source of truth, never the callback alone | Merchant account + KYC, get MID/key, test in staging first | Account/KYC = human. Calls automatable |
| Raw UPI QR | `UPI_ID`, `UPI_QR_IMAGE_URL`, `UPI_PAYEE_NAME` | No-gateway payment path — static QR + manual "Mark Paid" by admin, or WhatsApp-screenshot auto-confirm | Any UPI ID + a QR image upload | Fully human-driven by design; no payment API at all |
| MSG91 | `MSG91_AUTH_KEY`, `MSG91_WHATSAPP_INTEGRATED_NUMBER`, `MSG91_WHATSAPP_NAMESPACE`, `MSG91_INBOUND_WEBHOOK_TOKEN`, `MSG91_OTP_TEMPLATE_ID`, one `MSG91_*_TEMPLATE_ID` per event, `WHATSAPP_SMS_ENABLED`, `MSG91_WHATSAPP_COST_PER_MESSAGE_RUPEES` | BSP for WhatsApp templates + login OTP + inbound message webhook | Account, provision a WhatsApp number (needs underlying Meta Business verification), get templates approved, copy names into settings | Account signup automatable; number provisioning + template approval = human, days |
| Meta WhatsApp Cloud API | `META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_TEMPLATE_LANGUAGE`, `WHATSAPP_PROVIDER` | Direct alternative to MSG91 for the same templates | Business verification, WhatsApp app + number registration, permanent System User token, template approval under Meta's own naming | Verification/approval = human, days–weeks. Sends automatable after |
| Meta Ads / Instagram / Facebook | `META_ACCESS_TOKEN`, `META_PAGE_ID`, `META_AD_ACCOUNT_ID`, `META_PIXEL_ID`, `META_WEBHOOK_VERIFY_TOKEN`, `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Ad creation (paused-only, human must activate spend), organic IG posting, server-side Conversions API, ROAS reporting, DM/comment auto-reply bot (untested live) | Business Manager + verification, App Review for messaging/ads permissions, link IG Business account, long-lived token, webhook subscription, Pixel creation | Verification/App Review/webhook setup = human, days–weeks. API calls automatable after |
| Anthropic (Claude) | `ANTHROPIC_API_KEY` | Ad-brief generation, growth recommendations, business-plan forecasting, WhatsApp payment-screenshot vision verification, journal drafts — all raw `fetch` to the Messages API, no SDK, hardcoded to `claude-sonnet-5` | Create Console account/key | Fully automatable |
| Image generation | `IMAGE_GEN_API_KEY` (Gemini, primary, image-to-image capable), `OPENAI_API_KEY` (fallback, text-to-image only) | Ad creative, brand-awareness imagery, model/lifestyle photo generation from real product photos | Get API key(s) | Fully automatable |
| Shiprocket | `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `SHIPROCKET_PICKUP_LOCATION`, `SHIPROCKET_PICKUP_PINCODE`, `SHIPROCKET_WEBHOOK_TOKEN`, `SHIPROCKET_TOKEN_CACHE` | Live rate-check, order creation, AWB/label, pickup, tracking, RTO/NDR webhook. Hardcodes uniform package weight/dimensions (`UNIT_WEIGHT_KG`, `BOX_DIMENSIONS_CM`) assuming every product ships the same way | Account + KYC, register pickup warehouse, login credentials | Account/KYC/warehouse registration = human. Rate/order/label calls automatable after. **Non-uniform-product brands need a code change**, not just settings, for weight/dimensions |
| Brevo | `BREVO_API_KEY` | ~25 transactional email types via one `sendEmail()` choke point. Sender identity is hardcoded, not settings-driven | Account + domain verification, API key | Domain verification = human (DNS). Sends automatable after |
| Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (real env vars — everything else above is actually stored as `app_settings` rows, not env vars) | Database + Storage for the whole app; also the store for every other integration's credentials | Create project, run schema migration, set the two env vars | Project creation is API-automatable but typically done once per brand by a human; schema migration is automatable via CLI |
| Shopify import | none (scrapes public storefront JSON) | One-time catalogue import utility from any public Shopify store | N/A — ad hoc admin tool | Fully automatable (no auth needed), but it's a one-shot tool, not ongoing sync |
| Analytics/tracking | `META_PIXEL_ID` (browser pixel) + first-party `tracking_events` table + `@vercel/analytics` | Funnel/attribution reporting, ad attribution, Conversions API mirroring | Pixel creation on Meta (human); everything else needs no external account | Pixel setup = human; event firing automatable |
| Hosting (Vercel) | implicit — `vercel.json` crons, `@vercel/analytics`, `@vercel/og` | 8 scheduled crons, edge OG image generation for WhatsApp order-confirmation cards | Recreate cron schedules + `CRON_SECRET` on any host; verify `@vercel/og`/analytics work off-Vercel (may not without adaptation) | Cron/env setup automatable via Vercel API/CLI; migrating off Vercel needs human re-architecture of OG-image + cron pieces |

*Nearly all credentials above (except the three real env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`) live as rows in the `app_settings` table via `getSetting()`, editable from `/admin/settings` — this per-deployment pattern is already fairly white-label-friendly, since a new brand's own Supabase project just needs its own settings rows, not a redeploy.*

---

## 6. DATA MODEL

### Table inventory

| Table | Purpose | Brand-specific / generic |
|---|---|---|
| `orders`, `order_items` | Core order + line items | Structurally generic; "chapter" naming is brand vocabulary; many status flags encode Moonglasses-specific rules (post-barter, COD advance) |
| `inventory` | Stock per `chapter_slug` | Generic mechanism; the 16 seeded real SKU rows are brand-specific |
| `discount_rules`, `discount_rule_redemptions` | Bulk promo engine | Generic engine; seeded "Buy 3, half off 3rd" rule is brand-specific |
| `dynamic_chapters` | Admin-added products | Generic structure; "chapter"/"series" naming is brand vocabulary |
| `chapter_hero_overrides` | Per-product admin overrides | Generic override mechanism |
| `app_settings` | Key/value settings store | Generic mechanism; contents are the brand's own credentials/numbers |
| `journal_drafts`, `journal_articles` | Blog content | Generic structures; content is brand voice |
| `ad_briefs`, `agent_actions` | AI ad-ops + agent audit log | Generic |
| `explorer_submissions` | UGC wall | Generic, brand-named feature |
| `marketing_assets` | Ad creative photo library | Generic |
| `cart_sessions` | Anonymous cart + abandonment | Generic |
| `tracking_events` | First-party funnel events | Generic |
| `whatsapp_conversations`, `whatsapp_conversation_messages`, `whatsapp_messages` | 2-way inbox + 1-way send log | Generic (channel-specific, market choice) |
| `weekly_reports` | ROAS/funnel snapshot | Generic |
| `customers`, `otp_codes`, `customer_sessions`, `customer_addresses` | Auth + accounts | Generic; contains real PII once live |
| `loyalty_ledger` | Points ledger | Generic engine; "Miles" naming is brand vocabulary |
| `newsletter_subscribers`, `journal_newsletter_sends` | Newsletter | Generic |
| `imported_customer_records`, `legacy_customers`, `legacy_customer_purchases` | One-time legacy data import | **Real historical brand data — must never ship as template seed** |
| `leads`, `bot_conversations` | CRM + Meta bot state | Generic engine; script content is brand voice |
| `referrals` | Referral ledger | Generic |
| `reviews` | Product reviews | Generic |
| `return_requests`, `order_events` | Returns/RTO workflow | Generic |
| `coupon_codes`, `coupon_redemptions` | Coupon engine | Generic |
| `expenses` | Manual P&L expense log | Generic |
| `pending_orders` | Payment-webhook recovery snapshot | Generic |
| `preorders` | Drop deposit reservations | Generic mechanism; "Friday 7pm drop"/₹500 deposit are brand defaults |
| `creators`, `creator_agreements`, `creator_content` | Creator gifting program | Generic engine; agreement legal text is brand-specific |
| `business_plans` | AI forecast P&L drivers (jsonb) | Generic mechanism; driver values are the brand's own |
| `whatsapp_payment_confirmations` | Auto-confirm audit log | Generic |

No table in `supabase/schema.sql` stores hardcoded Moonglasses product rows directly — the 16 real SKUs live in `lib/chapters.ts` (TypeScript), not SQL. The one clearly brand-specific piece of `schema.sql` itself is the `inventory` seed block referencing those specific slugs directly.

### Current product model — exactly how it works

**"Chapter" = product**, defined in `types/chapter.ts`: `slug`, `name`, `series` ("Plastic" | "Metal"), `folder`, `images[]`, `primary`, `sideImage`, `modelImage?`, `story`, `price` (a single number), `live?`. Three sources merge at read time in `lib/chapters-dynamic.ts`: the static 16 (`lib/chapters.ts`), an empty Limited Series array (`lib/limited-series.ts`), and admin-added rows (`dynamic_chapters` table) — then `chapter_hero_overrides` (keyed by slug) can override name/image/price/story/collection/live on top of any of them.

**"Series" is a pseudo-category, not a real one** — a single free-text field that happens to also gate the fixed price (Plastic=1499, Metal=1999) purely by convention, not by any FK/join. There is no `categories` table. The homepage groups products by shape via a regex (`styleRimLens()` in `lib/chapters.ts`) that parses the display name string for shape/rim/lens color — not by any structured attribute.

**Stock** is tracked in `inventory`, one row per `chapter_slug`, no variant concept at all.

**`order_items`** references a purchase by `chapter_slug`/`chapter_name`/`unit_price` — text fields, no `sku_id`/`attributes` JSON.

**Pricing** is a direct `chapter.price` lookup in `lib/order-pricing.ts` — no variant-based price lookup exists anywhere. Only two real price points exist across the live catalogue: 1499 and 1999.

**Confirmed: there is no variant/SKU/attribute concept today.** Every "chapter" — static, Limited Series, or admin-added — is one single fixed SKU with one price, one image set, one stock counter. A customer cannot choose "this shape in a different color" as a variant of one product page; each colourway is an entirely separate product with its own slug, inventory row, and order-line reference.

### What must change for a generic category → product → SKU model

- Real `categories` table, replacing the `series` field + name-string regex parsing.
- Split "chapter" into a `products` table (shape/style) and a `skus`/`variants` table (colourway, material, price, images, stock) — decompose today's flat Chapter.
- A real `attributes`/`variant_options` model instead of parsing the display-name string.
- Move `price` to the SKU/variant level, removing the "series determines price" convention.
- Key `inventory` off `sku_id`, not `chapter_slug`.
- Key `order_items` off `sku_id` (with a denormalized attribute snapshot), not `chapter_slug`/`chapter_name`.
- Rework `chapter_hero_overrides` into a per-SKU (or shared per-product) override table.
- Rework the admin add/edit-product UI to create a product + one-or-more SKUs, not one flat row.
- Update every `chapter_slug`-keyed call site (`lib/inventory.ts`, `lib/order-pricing.ts`, `lib/post-barter.ts`, `lib/shiprocket.ts`, reviews, restock-notify, etc.) to the new key.

---

## 7. QUESTIONS A NEW BRAND OWNER MUST ANSWER

**Intake** (before build)
- Brand name, legal entity name, domain, support email, support phone → `brand.config.ts` core fields
- Product noun singular/plural (e.g. "cap"/"caps") → `productNounSingular`/`Plural`

**Catalog** (before build)
- Category taxonomy (what categories exist) → `categories` seed
- Products, their SKUs, attributes (size/color/material/etc.), price per SKU, stock per SKU → `products`/`skus`/`attribute_definitions`
- Product images per SKU → asset upload
- Per-unit weight/dimensions (for real shipping quotes) → replaces hardcoded `UNIT_WEIGHT_KG`/`BOX_DIMENSIONS_CM`

**Design** (before launch, can start with placeholders)
- Logo, favicon, primary/secondary/accent/background/text colors, heading/body fonts → `brand.config.ts` design tokens
- A short visual-language description for AI image generation prompts → `visualLanguage`

**Commercial terms** (TOGETHER, before launch)
- Loyalty program: enabled? display name, unit name, earn rate, redemption rate/threshold
- Referral program: enabled? discount amount, reward amount
- Discount rules / standing promos, if any
- COD advance amount (if COD offered)
- Return window (days), which return reasons are honored, whether shipping is ever refunded
- VIP thresholds (spend/order count)

**Payments** (before launch)
- Which gateway(s): Razorpay / Paytm / raw UPI QR / more than one?
- Live credentials once KYC clears (can build/test on staging keys first)
- COD offered at all?

**Shipping** (before launch)
- Courier account (Shiprocket or alternative), pickup warehouse address/contact, package weight/dimensions per product
- Free-shipping policy, if any (none exists by default today)
- Return/reverse-pickup process

**Meta/Ads** (can come later — MODULE)
- Business Manager verification status
- Ad account ID, Page ID, Pixel ID, IG Business Account ID
- Enable the autonomous ad-budget agent? If so, daily budget cap

**WhatsApp** (required before launch if WhatsApp notifications are wanted, else later)
- Provider choice: MSG91 or Meta Cloud API directly
- WhatsApp Business number, approved templates for each of the 12+ event types
- Inbound webhook token; enable WhatsApp-screenshot payment auto-confirm?

**Loyalty & referrals** (TOGETHER, before launch)
- Program display name and unit name (e.g. "Miles"/"Good Vibes" equivalent) and the actual earn/redeem logic desired

**Content** (before launch)
- Enable the Journal/blog module? Seed content or start empty?
- Policy page legal text: real address, GSTIN/tax ID, support contact
- Homepage marketing copy (currently hardcoded JSX, not config-driven — needs a real templating pass, see §4)

**Go-live**
- Domain DNS
- Supabase project creation + schema migration
- All env vars / settings populated
- Cron schedule setup on the hosting platform
- Full smoke test: browse → PDP → cart → checkout → admin order

---

## 8. DON'T CARRY OVER

- Leftover, unused "Travaholic" logo/sketch image assets in `public/images/brand/` — dead files from an apparent earlier brand pivot, not Moonglasses material and not template material either.
- Travel-blog-style Journal seed content (`lib/journal.ts`) — categories like "Road Trips," "Camping," "Packing Lists" and "Issue"-framed articles are remnants of the same earlier travel-brand concept, unrelated to a sunglasses (or any generic) storefront.
- Hardcoded personal developer email in `ORDER_NOTIFICATION_RECIPIENTS` (`lib/email.ts`).
- The WhatsApp support-number inconsistency — two different hardcoded numbers used in different places, neither settings-driven.
- Unfilled GSTIN placeholder text baked directly into invoice and policy-page copy ("add in Admin Settings" shipped to production).
- Unfilled placeholder phone number (`+91 00000 00000`) in policy pages.
- `RAZORPAY_DISABLED` as a hardcoded code constant rather than a setting — currently requires a code change (not an admin toggle) to re-enable Razorpay.
- The Limited Series pricing tier, defined but pointing at an empty product array.
- MSG91 inbound-webhook payload parsing, explicitly flagged in its own code comment as "unverified against a live incoming message."
- The Meta DM/comment bot (`lib/meta-bot.ts`), explicitly flagged in its own code comment as "not exercised against a live, approved app yet."
- Three WhatsApp return-notification settings (`MSG91_RETURN_APPROVED/DENIED/REFUNDED_TEMPLATE_ID`) that are referenced in `lib/settings.ts` but never actually used in a send call — dead configuration.
- The duplicated `SITE_URL` constant in `app/layout.tsx`, separate from `lib/brand.ts`'s `siteUrl` — a manual-sync footgun.
- The `capsBought` internal variable naming inconsistency (pre-dates the "Chapter" rename) — harmless but worth cleaning up during the terminology pass.
- Legacy customer-import tooling (`legacy_customers`, `imported_customer_records` tables, and the underlying one-time CSV import) — specific to Moonglasses' own migration history, not template material.
- `lib/shopify-import.ts` — fine to keep as a generic utility, but it's a one-shot tool, not something that needs brand-specific configuration; don't confuse it with an ongoing sync feature.

---

## 9. SUMMARY — Top 10 things that make white-labelling this codebase hard

1. **No real variant/SKU/attribute model.** Every "chapter" is a single fixed SKU; getting to category → product → SKU-with-attributes is a genuine data-model rewrite touching roughly 25 core files (cart, checkout, pricing, fulfillment, inventory, reviews, PDP). **Estimate: Large, 2–3 weeks.**
2. **Brand identity is split across two disconnected systems.** `lib/brand.ts`'s `BrandProfile` is settings-driven but only feeds AI generation; extensive hardcoded JSX copy on the homepage, about page, policy pages, invoice, and most of `email.ts` doesn't read from it at all. Unifying into one real `brand.config.ts` needs a full sweep of 50+ files. **Estimate: Large, 1–2 weeks.**
3. **WhatsApp template portability.** 12+ approved templates must be recreated and re-approved under each new brand's own WABA (MSG91 or Meta) — a human, multi-day approval process per brand, not automatable. **Estimate: Medium engineering, Large calendar-time (mostly waiting).**
4. **Payment gateway KYC and multi-provider complexity.** Three parallel payment paths (Razorpay disabled-by-flag, Paytm, raw UPI QR), each with its own credential/webhook setup; real KYC with a real gateway is required before any brand can go live. **Estimate: Medium engineering, Large calendar-time (KYC turnaround).**
5. **Physical-product assumptions baked into shipping.** `UNIT_WEIGHT_KG`/`BOX_DIMENSIONS_CM` assume "sunglasses in a case" and would silently misquote shipping cost for a different product category until code-changed. **Estimate: Small–Medium.**
6. **The "Chapters/Journal/Explorer" narrative framing is load-bearing, not cosmetic.** It's evidence the codebase itself is a pivot from an earlier travel-brand concept (leftover Travaholic assets, travel-category Journal seed), and the "Chapter" noun alone touches 118 files. **Estimate: Large, mechanical but extensive.**
7. **Meta/WhatsApp Business Verification is an external, human, multi-week dependency outside code's control**, and it has already concretely blocked a capability in this codebase's real history (programmatic WhatsApp template creation failed specifically because of it). **Estimate: Not code effort, but a hard external-timeline risk to plan around per brand.**
8. **AI features each hit the raw Anthropic API independently.** Ad-brief, business-plan, growth-recommendations, and payment-screenshot verification each duplicate their own `fetch`/parsing code rather than sharing a client — functionally fine, but a provider/model change means touching 5+ files individually. **Estimate: Small–Medium refactor, optional.**
9. **Several features are genuinely bespoke mechanics, not generic commerce plumbing** — "Pay With A Post," the autonomous ad-budget agent, and the WhatsApp-screenshot payment auto-confirm pipeline are sophisticated but specific to how this brand operates. Deciding which become opt-in MODULEs vs. get left behind per brand is a product decision as much as an engineering one. **Estimate: Product scoping + Medium engineering per module retained.**
10. **Several integration paths are untested against live traffic and say so in their own code comments** — the MSG91 inbound webhook shape and the Meta DM/comment bot are both flagged as unverified; a new brand's first real usage would be the first real test unless deliberately smoke-tested first (as was in fact just done for the WhatsApp payment-screenshot auto-confirm pipeline, which is now verified). **Estimate: Medium — a dedicated QA pass per integration before first brand launch.**
