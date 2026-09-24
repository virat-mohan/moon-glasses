type Service = {
  name: string;
  purpose: string;
  url: string;
  /** Settings keys that must all be set for this to count as connected. Omit for services the site can't run without. */
  requires?: string[];
  note?: string;
};

const SERVICES: { group: string; items: Service[] }[] = [
  {
    group: "Hosting & Data",
    items: [
      { name: "Vercel", purpose: "Hosts the website, runs scheduled jobs", url: "https://vercel.com/dashboard" },
      { name: "Supabase", purpose: "Database, file storage, all settings", url: "https://supabase.com/dashboard/projects" },
      { name: "GitHub", purpose: "Website code — every push redeploys", url: "https://github.com/virat-mohan/moon-glasses" },
    ],
  },
  {
    group: "Orders & Shipping",
    items: [
      { name: "UPI QR", purpose: "Checkout payments (confirmed via Mark Paid)", url: "/admin/orders", requires: ["UPI_ID", "UPI_QR_IMAGE_URL"] },
      { name: "Shiprocket", purpose: "Courier booking, labels, tracking", url: "https://app.shiprocket.in/", requires: ["SHIPROCKET_EMAIL", "SHIPROCKET_PASSWORD", "SHIPROCKET_PICKUP_LOCATION"] },
      { name: "Razorpay", purpose: "Card/UPI gateway (switched off at checkout)", url: "https://dashboard.razorpay.com/", requires: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"] },
    ],
  },
  {
    group: "Customer Messaging",
    items: [
      { name: "Resend", purpose: "Order, invoice and shipping emails", url: "https://resend.com/emails", requires: ["RESEND_API_KEY"], note: "Without this, customers get no emails." },
      { name: "WhatsApp Manager", purpose: "WhatsApp number & message templates", url: "https://business.facebook.com/wa/manage/home/", requires: ["META_WHATSAPP_ACCESS_TOKEN", "META_WHATSAPP_PHONE_NUMBER_ID"] },
      { name: "MSG91", purpose: "Login OTPs, fallback WhatsApp sender", url: "https://control.msg91.com/", requires: ["MSG91_AUTH_KEY"] },
    ],
  },
  {
    group: "Social & Marketing",
    items: [
      { name: "Instagram", purpose: "@moonglassesonline — connect & post from Social", url: "/admin/social", requires: ["INSTAGRAM_LOGIN_CONNECTED"] },
      { name: "Meta for Developers", purpose: "The \"Moon Glasses WA\" app behind WhatsApp & Instagram", url: "https://developers.facebook.com/apps/1396559109231529/" },
      { name: "Meta Business Settings", purpose: "Assets, system user, access tokens", url: "https://business.facebook.com/settings" },
      { name: "Meta Business Suite", purpose: "Facebook Page & Instagram inbox", url: "https://business.facebook.com/latest/home" },
      { name: "Meta Ads Manager", purpose: "Paid campaigns", url: "https://adsmanager.facebook.com/", requires: ["META_AD_ACCOUNT_ID"] },
      { name: "Meta Events Manager", purpose: "Pixel & conversion tracking", url: "https://business.facebook.com/events_manager2", requires: ["META_PIXEL_ID"] },
    ],
  },
  {
    group: "AI",
    items: [
      { name: "Anthropic (Claude)", purpose: "Ad copy, business plan, recommendations", url: "https://console.anthropic.com/", requires: ["ANTHROPIC_API_KEY"] },
      { name: "Google AI Studio", purpose: "Model & lifestyle photo generation", url: "https://aistudio.google.com/", requires: ["IMAGE_GEN_API_KEY"] },
      { name: "OpenAI", purpose: "Fallback image generation", url: "https://platform.openai.com/", requires: ["OPENAI_API_KEY"] },
    ],
  },
];

export function ConnectedServices({ present }: { present: Record<string, boolean> }) {
  return (
    <section className="mt-8 border border-divider p-5">
      <h2 className="font-sans text-body-m font-bold uppercase tracking-[0.03em] text-ink">Connected Services</h2>
      <p className="mt-1 text-caption text-secondary-text">Every outside service this store runs on, in one place.</p>
      <div className="mt-4 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {SERVICES.map(({ group, items }) => (
          <div key={group}>
            <p className="mb-2 text-micro uppercase tracking-[0.1em] text-secondary-text/70">{group}</p>
            <ul className="space-y-2.5">
              {items.map((s) => {
                const connected = s.requires ? s.requires.every((k) => present[k]) : null;
                const external = s.url.startsWith("http");
                return (
                  <li key={s.name} className="text-body-s">
                    <div className="flex items-center justify-between gap-2">
                      <a href={s.url} {...(external ? { target: "_blank", rel: "noreferrer" } : {})} className="font-bold text-ink underline underline-offset-4">
                        {s.name}
                        {external && " ↗"}
                      </a>
                      {connected !== null && (
                        <span className={`shrink-0 text-caption ${connected ? "text-tan-gold" : "text-secondary-text"}`}>
                          {connected ? "● Connected" : "○ Not set up"}
                        </span>
                      )}
                    </div>
                    <p className="text-caption text-secondary-text">{s.purpose}</p>
                    {s.note && !connected && <p className="text-caption text-paint-orange">{s.note}</p>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
