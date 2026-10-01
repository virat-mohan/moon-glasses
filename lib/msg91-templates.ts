import { getSetting, setSetting, type SettingKey } from "@/lib/settings";
import { getBrandProfile } from "@/lib/brand";

type TemplateDef = {
  settingKey: SettingKey;
  name: string;
  category: "UTILITY" | "MARKETING";
  body: string;
  example: string[];
  button?: { text: string; url: string };
};

/**
 * Every WhatsApp template the store sends. Variable order must match the
 * senders in lib/whatsapp-notify.ts. Meta rejects bodies that start or end
 * on a variable, so each one opens and closes on plain text.
 */
async function templateDefs(): Promise<TemplateDef[]> {
  const brand = await getBrandProfile();
  const site = brand.siteUrl.replace(/\/$/, "");
  const domain = site.replace(/^https?:\/\/(www\.)?/, "");
  const name = brand.brandName;
  const handle = brand.instagramHandle.startsWith("@") ? brand.instagramHandle : `@${brand.instagramHandle}`;

  return [
    {
      settingKey: "MSG91_ORDER_CONFIRMATION_TEMPLATE_ID",
      name: "order_confirmed",
      category: "UTILITY",
      body: `Hi {{1}}, your ${name} order #{{2}} is confirmed.\n\nTotal: {{3}}\n\nWe'll send tracking as soon as it ships.`,
      example: ["Anun", "AB12CD34", "₹1,499"],
    },
    {
      settingKey: "MSG91_SHIP_NOTIFICATION_TEMPLATE_ID",
      name: "ready_to_ship",
      category: "UTILITY",
      body: "New order ready to ship.\n\nOrder: #{{1}}\nCustomer: {{2}} ({{3}})\nItems: {{4}}\n\nShipping label: {{5}}\n\nPlease print it and hand the parcel to the courier.",
      example: ["AB12CD34", "Anun Dhawan", "919876543210", "1x Wayfarer, Black Green. Total ₹1,499", `${site}/samples/label-sample.pdf`],
    },
    {
      settingKey: "MSG91_NDR_TEMPLATE_ID",
      name: "delivery_attempt_failed",
      category: "UTILITY",
      body: "Hi {{1}}, our courier couldn't deliver order #{{2}} today. Reply here with a good time or an updated address and we'll get it to you.",
      example: ["Anun", "AB12CD34"],
    },
    {
      settingKey: "MSG91_RTO_INITIATED_TEMPLATE_ID",
      name: "order_returning",
      category: "UTILITY",
      body: "Hi {{1}}, order #{{2}} couldn't be delivered and is on its way back to us. Once it arrives we'll process your refund and let you know.",
      example: ["Anun", "AB12CD34"],
    },
    {
      settingKey: "MSG91_RTO_REFUNDED_TEMPLATE_ID",
      name: "order_refunded",
      category: "UTILITY",
      body: "Hi {{1}}, order #{{2}} is back with us and your refund of {{3}} has been processed. It can take 5 to 7 working days to show in your account.",
      example: ["Anun", "AB12CD34", "₹1,499"],
    },
    {
      settingKey: "MSG91_PWAP_CONFIRMED_TEMPLATE_ID",
      name: "pwap_order_confirmed",
      category: "UTILITY",
      body: `Hi {{1}}, your Pay With A Post order is in.\n\nYour code: {{2}}\n\nShare it with your followers and tag ${handle} when you post. When {{3}} friends check out with your code, your {{4}} ships free.`,
      example: ["Anun", "ANUN-MOON", "3", "Wayfarer, Black Green"],
    },
    {
      settingKey: "MSG91_PWAP_ORDER_LINK_TEMPLATE_ID",
      name: "pwap_order_link",
      category: "UTILITY",
      body: `Hi {{1}}, your Pay With A Post order is confirmed.\n\nYour code: {{2}}\n\nYour post image and steps are on your order page: ${domain}/barter/{{4}}\n\nPost it on Instagram, tag ${handle} and add your code in the caption. Your order ships when {{3}} people buy with your code.`,
      example: ["Anun", "ANUNAFTERGLOW", "3", "b306b861-551e-4b2a-a5e6-10636e46457a"],
    },
    {
      settingKey: "MSG91_PWAP_PROGRESS_TEMPLATE_ID",
      name: "pwap_progress",
      category: "UTILITY",
      body: "Good vibes are building, {{1}}. {{2}} of {{3}} friends have now bought with your code {{4}}. Just {{5}} more and your pair ships free.",
      example: ["Anun", "2", "3", "ANUN-MOON", "1"],
    },
    {
      settingKey: "MSG91_PWAP_SHIPPED_TEMPLATE_ID",
      name: "pwap_shipped",
      // Meta classed this as marketing because of the "come back" invite.
      category: "MARKETING",
      body: `Congratulations {{1}}! Your friends came through and your {{2}} has shipped, completely free. Thank you for spreading the good vibes.\n\nCome back for your 2nd free pair: place another Pay With A Post order at ${domain} and do it all again.`,
      example: ["Anun", "Wayfarer, Black Green"],
    },
    {
      settingKey: "MSG91_PWAP_FREE_PAIR_TEMPLATE_ID",
      name: "pwap_free_pair",
      category: "MARKETING",
      body: `Great news, {{1}}! Your code just hit another 3 sales, so you've earned another free pair. Use code {{2}} at checkout on ${domain} for any style, free. Valid 90 days.\n\nKeep sharing: every 3 more sales on your Pay With A Post code earns you another pair.`,
      example: ["Anun", "FREEANUN2XQ"],
    },
    {
      settingKey: "MSG91_ABANDONED_CART_TEMPLATE_ID",
      name: "cart_reminder",
      category: "MARKETING",
      body: `Hi {{1}}, you left {{2}} in your cart. It's saved for you at ${domain}/cart whenever you're ready.`,
      example: ["Anun", "1x Wayfarer, Black Green"],
    },
    {
      settingKey: "MSG91_BUYNOW10_TEMPLATE_ID",
      name: "cart_reminder_code",
      category: "MARKETING",
      body: `Hi {{1}}, still thinking about {{2}}? Use code {{3}} at checkout for a little extra off. Your cart is waiting at ${domain}/cart`,
      example: ["Anun", "1x Wayfarer, Black Green", "BUYNOW10"],
    },
    {
      settingKey: "MSG91_RESTOCK_TEMPLATE_ID",
      name: "back_in_stock",
      category: "MARKETING",
      body: "Hi {{1}}, {{2}} is back in stock. Grab it before it goes again: {{3}} See you soon.",
      example: ["Anun", "Wayfarer, Black Green", `${site}/chapter/moon-wayfarer-black-green`],
    },
    {
      settingKey: "MSG91_REVIEW_REQUEST_TEMPLATE_ID",
      name: "review_request",
      category: "MARKETING",
      body: "Hi {{1}}, hope you're loving your {{2}}. Got a minute to tell others what you think? {{3}} Thank you!",
      example: ["Anun", "Wayfarer, Black Green", "https://g.page/r/CbvWdBDo1oxlEBM/review"],
    },
    {
      settingKey: "MSG91_REFERRAL_INVITE_TEMPLATE_ID",
      name: "friend_invite",
      category: "MARKETING",
      body: `Hi {{1}}, {{2}} thinks you'd love ${name}. Here's their invite link: {{3}} Light tints, good vibes.`,
      example: ["Riya", "Anun", `${site}/?ref=ANUN`],
    },
    {
      settingKey: "MSG91_WINBACK_TEMPLATE_ID",
      name: "points_reminder",
      category: "MARKETING",
      body: `Hi {{1}}, it's been a while. You have {{2}} Good Vibes points waiting in your ${name} account. Come see what's new at ${domain}`,
      example: ["Anun", "250"],
    },
    {
      settingKey: "MSG91_LEGACY_WINBACK_TEMPLATE_ID",
      name: "first_customer_offer",
      category: "MARKETING",
      body: `Hi {{1}}, thanks for being one of our first ${name} customers. Here's a code for your next pair: {{2}} Tap below to see the new collection.`,
      example: ["Anun", "WELCOMEBACK"],
      button: { text: "Shop now", url: site },
    },
  ];
}

function toComponents(def: TemplateDef) {
  const components: Record<string, unknown>[] = [];
  components.push({ type: "BODY", text: def.body, example: { body_text: [def.example] } });
  if (def.button) {
    components.push({ type: "BUTTONS", buttons: [{ type: "URL", text: def.button.text, url: def.button.url }] });
  }
  return components;
}

function findNamespace(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  for (const [k, v] of Object.entries(value)) {
    if (k === "namespace" && typeof v === "string" && v) return v;
    const nested = findNamespace(v);
    if (nested) return nested;
  }
  return null;
}

export type TemplateCreateResult = { name: string; ok: boolean; detail: string };

/** Submits every template to MSG91 for Meta approval, saves each name into its setting, and saves the account namespace. */
export async function createMsg91Templates(): Promise<{ results: TemplateCreateResult[]; namespace: string | null }> {
  const authKey = await getSetting("MSG91_AUTH_KEY");
  const integratedNumber = await getSetting("MSG91_WHATSAPP_INTEGRATED_NUMBER");
  if (!authKey || !integratedNumber) {
    throw new Error("Add the MSG91 Auth Key and WhatsApp Integrated Number in Settings first.");
  }
  const results: TemplateCreateResult[] = await Promise.all(
    (await templateDefs()).map(async (def): Promise<TemplateCreateResult> => {
      try {
        const res = await fetch("https://control.msg91.com/api/v5/whatsapp/client-panel-template/", {
          method: "POST",
          headers: { authkey: authKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            integrated_number: integratedNumber,
            template_name: def.name,
            language: "en",
            category: def.category,
            button_url: def.button ? "true" : "false",
            components: toComponents(def),
          }),
        });
        const data = await res.json().catch(() => null);
        const message =
          typeof data?.errors === "string" ? data.errors : JSON.stringify(data?.errors ?? data?.message ?? data ?? res.status);
        const alreadyExists = /already exist|already English content|doesn.t match the one that.s already associated/i.test(message);
        const ok = (res.ok && !data?.hasError) || alreadyExists;
        if (ok) await setSetting(def.settingKey, def.name);
        else console.error("MSG91 template create failed", def.name, message);
        return { name: def.name, ok, detail: ok ? (alreadyExists ? "Already exists" : "Submitted for approval") : message };
      } catch (err) {
        return { name: def.name, ok: false, detail: err instanceof Error ? err.message : "Request failed" };
      }
    })
  );

  let namespace: string | null = null;
  try {
    const res = await fetch(`https://control.msg91.com/api/v5/whatsapp/get-template-client/${integratedNumber}`, {
      headers: { authkey: authKey },
    });
    namespace = findNamespace(await res.json().catch(() => null));
    if (namespace) await setSetting("MSG91_WHATSAPP_NAMESPACE", namespace);
  } catch (err) {
    console.error("Could not read MSG91 namespace", err);
  }

  return { results, namespace };
}

/** Current approval status of each template, straight from MSG91. */
export async function listMsg91TemplateStatuses(): Promise<{ name: string; status: string }[]> {
  const authKey = await getSetting("MSG91_AUTH_KEY");
  const integratedNumber = await getSetting("MSG91_WHATSAPP_INTEGRATED_NUMBER");
  if (!authKey || !integratedNumber) return [];
  const res = await fetch(`https://control.msg91.com/api/v5/whatsapp/get-template-client/${integratedNumber}`, {
    headers: { authkey: authKey },
  });
  const data = await res.json().catch(() => null);
  const rows: unknown[] = Array.isArray(data?.data) ? data.data : [];
  return rows.map((row) => {
    const r = row as { name?: string; languages?: { status?: string }[]; status?: string };
    return { name: r.name ?? "?", status: r.languages?.[0]?.status ?? r.status ?? "unknown" };
  });
}
