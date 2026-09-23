import { getSetting } from "@/lib/settings";

/**
 * Direct Meta WhatsApp Cloud API integration — an alternative to the MSG91
 * BSP integration in lib/msg91.ts, chosen per-deployment via the
 * WHATSAPP_PROVIDER setting (see sendTemplateByName's dispatch in
 * lib/whatsapp-notify.ts). Both providers ultimately do the same thing —
 * send a pre-approved WhatsApp template with body variables and an optional
 * header image — so this file mirrors sendMsg91Template's signature and
 * return shape exactly, making the two genuinely swappable.
 *
 * Setup required in Meta's own dashboards (none of this can be done from
 * here — see the /admin/settings hints for the short version):
 *  1. A Facebook Business Manager account, business-verified.
 *  2. A WhatsApp app at developers.facebook.com with a registered phone
 *     number — gives you the Phone Number ID this file needs.
 *  3. A permanent System User access token (Business Settings → System
 *     Users) — the default 24h token from the quickstart is NOT usable for
 *     real orders.
 *  4. Each template (order confirmation, shipping update, etc.) submitted
 *     and approved by Meta under its own name/language — that approved
 *     name is what METATEMPLATE settings below must contain exactly.
 *
 * Reused as-is for any future brand on this codebase: swap the three
 * META_WHATSAPP_* settings and WHATSAPP_PROVIDER=meta_cloud, no code change.
 */

function toE164(phone: string) {
  const digits = phone.replace(/\D/g, "");
  // Meta expects the number with country code, no leading +. Assume India
  // (91) for a bare 10-digit number, same convention as msg91.ts's toMobile.
  return digits.length === 10 ? `91${digits}` : digits;
}

async function getMetaCloudCredentials() {
  const [accessToken, phoneNumberId] = await Promise.all([
    getSetting("META_WHATSAPP_ACCESS_TOKEN"),
    getSetting("META_WHATSAPP_PHONE_NUMBER_ID"),
  ]);
  if (!accessToken || !phoneNumberId) return null;
  return { accessToken, phoneNumberId };
}

type MetaComponent =
  | { type: "header"; parameters: [{ type: "image"; image: { link: string } } | { type: "document"; document: { link: string; filename?: string } }] }
  | { type: "body"; parameters: { type: "text"; text: string }[] };

/**
 * Sends one WhatsApp template message via Meta's Graph API. Mirrors
 * sendMsg91Template(templateName, phone, bodyValues, header) exactly — same
 * argument order, same { sent, messageId? } return shape — so
 * sendTemplateByName in lib/whatsapp-notify.ts can call either provider
 * interchangeably.
 */
export async function sendMetaCloudTemplate(
  templateName: string,
  phone: string,
  bodyValues: string[],
  header?: { type: "image" | "document"; url: string; filename?: string }
) {
  const enabled = await getSetting("WHATSAPP_SMS_ENABLED");
  if (enabled !== "true") {
    return { sent: false as const };
  }

  const creds = await getMetaCloudCredentials();
  if (!creds) return { sent: false as const };

  const languageCode = (await getSetting("META_WHATSAPP_TEMPLATE_LANGUAGE")) || "en_US";

  const components: MetaComponent[] = [];
  if (header) {
    components.push(
      header.type === "image"
        ? { type: "header", parameters: [{ type: "image", image: { link: header.url } }] }
        : { type: "header", parameters: [{ type: "document", document: { link: header.url, filename: header.filename ?? "label.pdf" } }] }
    );
  }
  if (bodyValues.length > 0) {
    components.push({ type: "body", parameters: bodyValues.map((v) => ({ type: "text", text: v })) });
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${creds.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toE164(phone),
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.error) {
      console.error("Meta WhatsApp Cloud API template send failed", res.status, data?.error ?? data);
      return { sent: false as const };
    }
    const messageId = data?.messages?.[0]?.id as string | undefined;
    return { sent: true as const, messageId };
  } catch (err) {
    console.error("Meta WhatsApp Cloud API template send failed", err);
    return { sent: false as const };
  }
}
