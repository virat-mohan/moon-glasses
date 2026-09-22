"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type Field = { key: string; label: string; hint: string };

const GROUPS: { label: string; fields: Field[] }[] = [
  {
    label: "Payments",
    fields: [
      { key: "RAZORPAY_KEY_ID", label: "Razorpay Key ID", hint: "Test or live Key ID from Razorpay → Settings → API Keys." },
      { key: "RAZORPAY_KEY_SECRET", label: "Razorpay Key Secret", hint: "Paired secret for the Key ID above." },
      { key: "RAZORPAY_WEBHOOK_SECRET", label: "Razorpay Webhook Secret", hint: "Make up any random string, then paste the same value into Razorpay Dashboard → Settings → Webhooks when you add https://moon-glasses.store/api/webhooks/razorpay as a webhook (subscribe to payment.captured, refund.processed, refund.failed). This is the real safety net if a customer's payment succeeds but their browser never makes it back to confirm the order." },
    ],
  },
  {
    label: "UPI QR Payment (works without Razorpay)",
    fields: [
      { key: "UPI_ID", label: "UPI ID (VPA)", hint: "e.g. moonglasses@okhdfcbank — shown at checkout as a fallback for anyone who can't scan." },
      { key: "UPI_QR_IMAGE_URL", label: "UPI QR Image URL", hint: "Upload your QR image at /admin/marketing-assets first, then paste its URL here. Shown at checkout as a real, standalone payment method — no Razorpay account needed. Orders placed this way stay unpaid until you confirm the payment landed and click \"Mark Paid\" in /admin/orders." },
      { key: "UPI_PAYEE_NAME", label: "Payee Name", hint: "Shown alongside the QR and used in the UPI deep link. Defaults to your brand name if unset." },
    ],
  },
  {
    label: "Email",
    fields: [
      { key: "BREVO_API_KEY", label: "Brevo API Key", hint: "From Brevo → Settings → SMTP & API → API Keys. Powers every customer email — OTP, order confirmation, abandoned cart, newsletter." },
    ],
  },
  {
    label: "AI",
    fields: [
      { key: "ANTHROPIC_API_KEY", label: "Anthropic API Key", hint: "Powers Claude-generated Journal drafts and ad briefs." },
      { key: "IMAGE_GEN_API_KEY", label: "Image Gen API Key (Gemini)", hint: "Google AI Studio API key — powers ad creative image and reel (Veo) generation. Tried first if set." },
      { key: "OPENAI_API_KEY", label: "OpenAI API Key (fallback)", hint: "Used for ad creative image generation (gpt-image-1) if the Gemini key above is missing or its call fails." },
    ],
  },
  {
    label: "Meta (Ads, Instagram, DM Bot)",
    fields: [
      { key: "META_ACCESS_TOKEN", label: "Meta Access Token", hint: "From Meta Business Manager, for the ad account and Instagram account below." },
      { key: "META_AD_ACCOUNT_ID", label: "Meta Ad Account ID", hint: "e.g. act_1234567890" },
      { key: "META_PAGE_ID", label: "Meta Page ID", hint: "The Facebook Page linked to your ad account — required to create ad creatives." },
      { key: "INSTAGRAM_BUSINESS_ACCOUNT_ID", label: "Instagram Business Account ID", hint: "For auto-posting approved Explorer photos as Instagram Stories." },
      { key: "META_WEBHOOK_VERIFY_TOKEN", label: "Meta Webhook Verify Token", hint: "Make up any random string, then paste the same value into Meta's App Dashboard → Webhooks → Verify Token when you subscribe to Instagram/Messenger events. Required for the DM/comment bot." },
      { key: "META_PIXEL_ID", label: "Meta Pixel ID", hint: "Enables the Meta pixel + server-side Conversions API mirror on the site." },
    ],
  },
  {
    label: "MSG91 (WhatsApp / SMS)",
    fields: [
      { key: "WHATSAPP_SMS_ENABLED", label: "Enable WhatsApp/SMS", hint: "Off by default at launch — every WhatsApp/SMS send in the app (OTP, order confirmation, NDR/RTO nudges, referral invites, abandoned cart, win-back) is silenced until this is set to exactly \"true\". Email keeps working regardless. Flip this on once MSG91 is actually configured below." },
      { key: "MSG91_AUTH_KEY", label: "MSG91 Auth Key", hint: "From MSG91 dashboard → API keys. Shared by all MSG91 sends below." },
      { key: "MSG91_OTP_TEMPLATE_ID", label: "MSG91 OTP Flow Slug", hint: "Not a numeric ID — the Flow's URL slug (e.g. \"login-otp\"), found via the </> \"View Code\" button on the Flow builder canvas. One variable (VAR1) for the code." },
      { key: "MSG91_ORDER_CONFIRMATION_TEMPLATE_ID", label: "MSG91 Order Confirmation Flow Slug", hint: "Same as above — the Flow's URL slug, not an ID. Three variables in order: customer name, order number, total." },
      { key: "MSG91_ABANDONED_CART_TEMPLATE_ID", label: "MSG91 Abandoned Cart Flow Slug", hint: "Same as above — the Flow's URL slug, not an ID. Two variables in order: customer name, item summary." },
      { key: "MSG91_NDR_TEMPLATE_ID", label: "MSG91 NDR Nudge Flow Slug", hint: "Same as above — the Flow's URL slug, not an ID. Two variables in order: customer name, order number. Sent automatically when a delivery attempt fails, before it becomes an RTO." },
      { key: "MSG91_REFERRAL_INVITE_TEMPLATE_ID", label: "MSG91 Referral Invite Flow Slug", hint: "Same as above — the Flow's URL slug, not an ID. Three variables in order: friend name, referrer name, referral link. Sent when a customer invites a friend from their account page. Optional — invites always go by email regardless." },
      { key: "MSG91_WINBACK_TEMPLATE_ID", label: "MSG91 Win-Back Flow Slug", hint: "Same as above — the Flow's URL slug, not an ID. Two variables in order: customer name, Good Vibes balance. Optional — win-back always goes by email regardless." },
      { key: "MSG91_RTO_INITIATED_TEMPLATE_ID", label: "MSG91 RTO Initiated Flow Slug", hint: "Same as above — the Flow's URL slug, not an ID. Two variables in order: customer name, order number. Sent when a shipment starts heading back to you, before the refund. Optional — an email always goes out regardless." },
      { key: "MSG91_RTO_REFUNDED_TEMPLATE_ID", label: "MSG91 RTO Refunded Flow Slug", hint: "Same as above — the Flow's URL slug, not an ID. Three variables in order: customer name, order number, refund amount. Sent once the item is back and the refund has gone through. Optional — an email always goes out regardless." },
      { key: "MSG91_WHATSAPP_INTEGRATED_NUMBER", label: "MSG91 WhatsApp Integrated Number", hint: "The WhatsApp-enabled number shown as \"Active\" under MSG91 → WhatsApp. Required for /admin/whatsapp to send free-text replies (separate from the template Flows above)." },
      { key: "MSG91_INBOUND_WEBHOOK_TOKEN", label: "MSG91 Inbound Webhook Token", hint: "A password you make up and also paste into MSG91 → WhatsApp → Settings → Webhook, so only MSG91 can post incoming messages to /api/webhooks/msg91-whatsapp-inbound. Leave blank to accept unauthenticated (not recommended once live)." },
    ],
  },
  {
    label: "Shiprocket",
    fields: [
      { key: "SHIPROCKET_EMAIL", label: "Shiprocket Email", hint: "The login email for your Shiprocket account." },
      { key: "SHIPROCKET_PASSWORD", label: "Shiprocket Password", hint: "Used to fetch an API token — Shiprocket doesn't issue separate API keys." },
      { key: "SHIPROCKET_PICKUP_LOCATION", label: "Shiprocket Pickup Location", hint: "The exact pickup location nickname configured in your Shiprocket dashboard under Settings → Pickup Addresses." },
      { key: "SHIPROCKET_PICKUP_PINCODE", label: "Shiprocket Pickup Pincode", hint: "The pincode of that same pickup address — used to calculate live shipping rates at checkout." },
      { key: "SHIPROCKET_WEBHOOK_TOKEN", label: "Shiprocket Webhook Token", hint: "Make up any random string, then paste the same value into Shiprocket → Settings → API → Webhooks as the API secret/header value. Lets shipment status update live on the dashboard instead of needing manual refresh." },
      { key: "WAREHOUSE_EMAIL", label: "Warehouse Manager Email", hint: "Gets an email with the order details, invoice, and shipping label (AWB) the moment an order is shipped and a courier is assigned. Leave blank to skip this notification entirely." },
    ],
  },
  {
    label: "Loyalty & Referrals",
    fields: [
      { key: "COD_ADVANCE_AMOUNT_RUPEES", label: "COD Advance Amount (₹)", hint: "Charged upfront to confirm a Cash on Delivery order; the rest is collected by the courier. Defaults to ₹99 if unset." },
      { key: "REFERRAL_DISCOUNT_RUPEES", label: "Referral Discount (₹)", hint: "Flat discount a new customer gets on their first order when they check out with someone's referral code. Defaults to ₹200 if unset." },
      { key: "REFERRAL_REWARD_MILES", label: "Referral Reward (Good Vibes)", hint: "Good Vibes credited to the referrer once the referred order is placed. Defaults to 500 (= ₹200 at the current redemption rate) if unset." },
      { key: "WINBACK_AFTER_DAYS", label: "Win-Back Nudge After (Days)", hint: "How many days since a customer's last order before they get a \"we miss you\" nudge — repeats on the same interval if they still haven't ordered again. Defaults to 60 if unset." },
      { key: "VIP_MIN_SPEND_RUPEES", label: "VIP Threshold — Total Spent (₹)", hint: "A customer is flagged VIP on /admin/customers once their lifetime spend crosses this. Defaults to ₹5,000 if unset." },
      { key: "VIP_MIN_ORDERS", label: "VIP Threshold — Order Count", hint: "A customer is also flagged VIP once they've placed this many orders, regardless of spend. Defaults to 3 if unset." },
    ],
  },
  {
    label: "Pay With A Post",
    fields: [
      { key: "POST_BARTER_MIN_FOLLOWERS", label: "Gift First Follower Threshold", hint: "Instagram accounts at or above this follower count qualify for Gift First (ship now, post after) instead of Post First. Defaults to 5,000 if unset." },
      { key: "POST_BARTER_GIFT_FIRST_DAILY_CAP", label: "Gift First Daily Cap", hint: "Max number of Gift First orders (real inventory shipped on trust, before payment) accepted per calendar day (IST). Anyone over the follower threshold once this is hit for the day is safely routed to Post First instead. Also drives the \"Only N spots left today\" urgency badge shown on the homepage and at checkout. Defaults to 10 if unset." },
      { key: "POST_BARTER_REQUIRED_ORDERS", label: "Post First — Orders Required To Qualify", hint: "How many real, paid orders a Post First shopper's code needs to drive before their own order ships free. Defaults to 3 if unset." },
      { key: "POST_BARTER_FRIEND_DISCOUNT_RUPEES", label: "Friend Discount On Redemption (₹)", hint: "Discount a friend gets for checking out with someone's Pay With A Post code — codes are attribution-only by design, so this is 0 (full price) unless changed. Defaults to 0 if unset." },
    ],
  },
  {
    label: "Finance",
    fields: [
      { key: "COGS_PER_UNIT_RUPEES", label: "Cost Per Unit (₹)", hint: "What you pay the vendor per pair, used to compute COGS on the P&L page. Defaults to ₹250 if unset." },
      { key: "LOW_STOCK_THRESHOLD_UNITS", label: "Low-Stock Alert Threshold (units)", hint: "Sends an email to the team the moment a Chapter's stock dips to or under this number. Defaults to 10 if unset." },
    ],
  },
  {
    label: "System",
    fields: [
      { key: "CRON_SECRET", label: "Cron Secret", hint: "Protects /api/cron/* routes — set this once you wire up Vercel Cron or another scheduler." },
    ],
  },
];

export default function AdminSettingsPage() {
  const [present, setPresent] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => setPresent(data.present ?? {}))
      .finally(() => setLoading(false));
  }, []);

  async function save(key: string) {
    const value = drafts[key];
    if (!value) return;
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    setPresent((prev) => ({ ...prev, [key]: true }));
    setDrafts((prev) => ({ ...prev, [key]: "" }));
    setSavedKey(key);
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">API Keys & Settings</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Stored server-side in Supabase, never sent to the browser. Add a key any time — features
        that depend on it switch on automatically once it&apos;s here.
      </p>

      {loading ? (
        <p className="mt-8 text-body-s text-secondary-text">Loading...</p>
      ) : (
        <div className="mt-10 space-y-10">
          {GROUPS.map((group) => (
            <div key={group.label} className="border-t border-divider pt-6">
              <p className="mb-4 text-micro uppercase tracking-[0.15em] text-secondary-text">
                {group.label}
              </p>
              <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
                {group.fields.map((f) => (
                  <div key={f.key}>
                    <div className="flex items-center gap-3">
                      <p className="font-sans text-body-s uppercase tracking-[0.03em] text-ink">
                        {f.label}
                      </p>
                      <span
                        className={`text-micro uppercase tracking-[0.05em] ${
                          present[f.key] ? "text-tan-gold" : "text-secondary-text"
                        }`}
                      >
                        {present[f.key] ? "● Configured" : "○ Not set"}
                      </span>
                    </div>
                    <p className="mt-1 text-caption text-secondary-text">{f.hint}</p>
                    <div className="mt-3 flex gap-3">
                      <div className="relative flex-1">
                        <input
                          type={visibleKeys[f.key] ? "text" : "password"}
                          placeholder={present[f.key] ? "Enter a new value to replace it" : "Paste value here"}
                          value={drafts[f.key] ?? ""}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [f.key]: e.target.value }))}
                          className="w-full border border-ink/30 bg-surface px-4 py-2 pr-10 font-sans text-body-s text-ink outline-none focus:border-ink"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setVisibleKeys((prev) => ({ ...prev, [f.key]: !prev[f.key] }))
                          }
                          aria-label={visibleKeys[f.key] ? "Hide value" : "Show value"}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary-text hover:text-ink"
                        >
                          {visibleKeys[f.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <button
                        onClick={() => save(f.key)}
                        className="border border-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream"
                      >
                        {savedKey === f.key ? "Saved ✓" : "Save"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
