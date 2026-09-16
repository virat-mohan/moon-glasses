import { getSetting } from "@/lib/settings";

function toMobile(phone: string) {
  const digits = phone.replace(/\D/g, "");
  // MSG91 expects the number with country code, no leading +. Assume India
  // (91) for a bare 10-digit number; pass through anything that already
  // includes a country code.
  return digits.length === 10 ? `91${digits}` : digits;
}

/**
 * Sends a message via one of MSG91's OneAPI Flows. `flowSlug` is the Flow's
 * URL slug (e.g. "login-otp"), found via the `</>` "View Code" button on the
 * Flow builder canvas — NOT a numeric/UUID template ID, MSG91's newer OneAPI
 * flows key off the slug directly in the request URL. `variables` map
 * positionally to VAR1, VAR2, ... in the Flow's template. Best-effort —
 * returns { sent: false } rather than throwing so the caller can decide what
 * to do next.
 */
export async function sendMsg91Flow(
  flowSlug: string | null,
  phone: string,
  variables: string[],
  mediaUrl?: string
) {
  // Hard off-switch for launch — going live on email only, WhatsApp/SMS is
  // being set up separately. This is the one choke point every WhatsApp
  // send in the app routes through (OTP, order confirmation, NDR/RTO
  // nudges, referral invites, abandoned cart, win-back), so flipping this
  // one setting is enough to silence all of them without touching each
  // call site. Set WHATSAPP_SMS_ENABLED to "true" in /admin/settings once
  // MSG91 is actually configured and ready to go live.
  const enabled = await getSetting("WHATSAPP_SMS_ENABLED");
  if (enabled !== "true") {
    return { sent: false as const };
  }

  const authKey = await getSetting("MSG91_AUTH_KEY");
  if (!authKey || !flowSlug) {
    return { sent: false as const };
  }

  const varFields = Object.fromEntries(variables.map((v, i) => [`VAR${i + 1}`, v]));
  // Media-header field placement isn't confirmed against a real
  // media-attached template yet (only verified the plain-text OTP shape) —
  // this is the common BSP pattern (a `media` object alongside `mobiles`),
  // check a real send once the Order Confirmation Flow has an image header
  // configured and adjust if MSG91 rejects or ignores it.
  const to: Record<string, unknown> = { mobiles: toMobile(phone), variables: varFields };
  if (mediaUrl) to.media = { url: mediaUrl };

  try {
    const res = await fetch(`https://control.msg91.com/api/v5/oneapi/api/flow/${flowSlug}/run`, {
      method: "POST",
      headers: {
        authkey: authKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          sendTo: [{ to: [to], variables: [] }],
        },
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.type === "error") {
      console.error("MSG91 send failed", res.status, data);
      return { sent: false as const };
    }
    // Exact response shape for message-id tracking hasn't been verified
    // against a live success response yet — check the real payload once a
    // send actually succeeds and adjust this lookup if delivery/read
    // tracking doesn't populate in /admin/reports.
    const messageId = data?.request_id ?? data?.data?.request_id ?? data?.data?.[0]?.message_id ?? null;
    return { sent: true as const, messageId: messageId ? String(messageId) : undefined };
  } catch (err) {
    console.error("MSG91 send failed", err);
    return { sent: false as const };
  }
}

/**
 * Sends a WhatsApp template message via a OneAPI Flow. Distinct from
 * sendMsg91Flow above: that one is confirmed working for the SMS OTP Flow,
 * which takes variables as flat VAR1/VAR2 strings — but MSG91's own
 * generated code sample for a WhatsApp-template Flow uses a different shape,
 * body_1/body_2 keyed objects ({type: "text", value}), matching the
 * template's {{1}}, {{2}}, ... placeholders. Sending VAR1/VAR2 to a WhatsApp
 * Flow gets silently accepted by the API ("queued successfully") but never
 * actually delivered by WhatsApp — this was the root cause of abandoned-cart
 * WhatsApp nudges never arriving despite MSG91 reporting success. Every
 * WhatsApp-template send (abandoned cart, order confirmation, NDR/RTO
 * nudges, referral, win-back) should use this, not sendMsg91Flow.
 */
export async function sendMsg91WhatsAppFlow(
  flowSlug: string | null,
  phone: string,
  bodyValues: string[],
  mediaUrl?: string
) {
  const enabled = await getSetting("WHATSAPP_SMS_ENABLED");
  if (enabled !== "true") {
    return { sent: false as const };
  }

  const authKey = await getSetting("MSG91_AUTH_KEY");
  if (!authKey || !flowSlug) {
    return { sent: false as const };
  }

  const variables = Object.fromEntries(
    bodyValues.map((v, i) => [`body_${i + 1}`, { type: "text", value: v }])
  );

  const to: Record<string, unknown> = { mobiles: toMobile(phone), variables };
  if (mediaUrl) to.media = { url: mediaUrl };

  try {
    const res = await fetch(`https://control.msg91.com/api/v5/oneapi/api/flow/${flowSlug}/run`, {
      method: "POST",
      headers: {
        authkey: authKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          sendTo: [{ to: [to], variables }],
        },
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.hasError) {
      console.error("MSG91 WhatsApp flow send failed", res.status, data);
      return { sent: false as const };
    }
    const messageId = data?.data?.request_id ?? data?.request_id ?? null;
    return { sent: true as const, messageId: messageId ? String(messageId) : undefined };
  } catch (err) {
    console.error("MSG91 WhatsApp flow send failed", err);
    return { sent: false as const };
  }
}

/**
 * Sends a message via one of MSG91's newer Campaign API campaigns (Campaigns
 * → Flows in the dashboard can create either a "Flow" — handled by
 * sendMsg91Flow above, hitting /oneapi/api/flow — or a "Campaign", which is
 * a different product hitting /campaign/api/campaigns with a different
 * payload shape: variables are keyed body_1, body_2, ... (matching the
 * template's {{1}}, {{2}}, ...) and each is a {type, value} object rather
 * than a flat string, sent under both the recipient's own `variables` and a
 * top-level `variables` per MSG91's documented curl example. Use this for a
 * template ID that's a Campaign slug rather than a Flow slug — check which
 * kind you have by whether MSG91 calls it a Flow or a Campaign in its UI.
 */
export async function sendMsg91Campaign(
  campaignSlug: string | null,
  phone: string,
  bodyValues: string[]
) {
  const enabled = await getSetting("WHATSAPP_SMS_ENABLED");
  if (enabled !== "true") {
    return { sent: false as const };
  }

  const authKey = await getSetting("MSG91_AUTH_KEY");
  if (!authKey || !campaignSlug) {
    return { sent: false as const };
  }

  const variables = Object.fromEntries(
    bodyValues.map((v, i) => [`body_${i + 1}`, { type: "text", value: v }])
  );

  try {
    const res = await fetch(`https://control.msg91.com/api/v5/campaign/api/campaigns/${campaignSlug}/run`, {
      method: "POST",
      headers: {
        authkey: authKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          sendTo: [{ to: [{ mobiles: toMobile(phone), variables }], variables }],
        },
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.hasError) {
      console.error("MSG91 campaign send failed", res.status, data);
      return { sent: false as const };
    }
    const messageId = data?.data?.request_id ?? data?.request_id ?? null;
    return { sent: true as const, messageId: messageId ? String(messageId) : undefined };
  } catch (err) {
    console.error("MSG91 campaign send failed", err);
    return { sent: false as const };
  }
}

/**
 * Sends a WhatsApp template message via MSG91's bulk outbound-message API —
 * a third distinct MSG91 product from the two above (Flow and Campaign),
 * addressing the template by its actual approved name plus the WABA's
 * namespace, rather than a Flow/Campaign slug. This is what MSG91's own
 * "Send WhatsApp" UI generates code for, and is the simplest of the three:
 * one endpoint, one payload shape, works for any approved template just by
 * name. Prefer this over sendMsg91Flow/sendMsg91Campaign for any new
 * template going forward. `bodyValues` map positionally to {{1}}, {{2}}, ...
 * in the template.
 */
export async function sendMsg91Template(
  templateName: string,
  phone: string,
  bodyValues: string[],
  header?: { type: "image" | "document"; url: string; filename?: string }
) {
  const enabled = await getSetting("WHATSAPP_SMS_ENABLED");
  if (enabled !== "true") {
    return { sent: false as const };
  }

  const authKey = await getSetting("MSG91_AUTH_KEY");
  const integratedNumber = await getSetting("MSG91_WHATSAPP_INTEGRATED_NUMBER");
  const namespace = await getSetting("MSG91_WHATSAPP_NAMESPACE");
  if (!authKey || !integratedNumber || !namespace) {
    return { sent: false as const };
  }

  const components: Record<string, { type: string; value: string; filename?: string }> = Object.fromEntries(
    bodyValues.map((v, i) => [`body_${i + 1}`, { type: "text", value: v }])
  );
  if (header) {
    components.header_1 = {
      type: header.type,
      value: header.url,
      ...(header.type === "document" ? { filename: header.filename ?? "label.pdf" } : {}),
    };
  }

  try {
    const res = await fetch("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", {
      method: "POST",
      headers: { authkey: authKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        integrated_number: integratedNumber,
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: templateName,
            language: { code: "en", policy: "deterministic" },
            namespace,
            to_and_components: [{ to: [toMobile(phone)], components }],
          },
        },
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.hasError) {
      console.error("MSG91 template send failed", res.status, data);
      return { sent: false as const };
    }
    const messageId =
      data?.data?.[0]?.message_id ?? data?.data?.request_id ?? data?.request_id ?? null;
    return { sent: true as const, messageId: messageId ? String(messageId) : undefined };
  } catch (err) {
    console.error("MSG91 template send failed", err);
    return { sent: false as const };
  }
}

/**
 * Sends a free-text WhatsApp message (not a pre-approved template) — only
 * valid within Meta's 24-hour "session" window after the customer last
 * messaged in, which is exactly the admin-inbox reply use case. Payload
 * shape follows MSG91's documented WhatsApp outbound-message endpoint but
 * hasn't been exercised against a live send yet — check the real response
 * once the first admin reply goes out and adjust the messageId lookup below
 * if delivery status doesn't come back.
 */
export async function sendWhatsAppSessionMessage(phone: string, text: string) {
  const authKey = await getSetting("MSG91_AUTH_KEY");
  const integratedNumber = await getSetting("MSG91_WHATSAPP_INTEGRATED_NUMBER");
  if (!authKey || !integratedNumber) {
    return { sent: false as const, error: "MSG91 Auth Key or WhatsApp number not configured" };
  }

  try {
    const res = await fetch("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/", {
      method: "POST",
      headers: { authkey: authKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        integrated_number: integratedNumber,
        content: { type: "text", text: { body: text } },
        recipient_number: toMobile(phone),
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("MSG91 session message send failed", res.status, data);
      return { sent: false as const, error: data?.message ?? `HTTP ${res.status}` };
    }
    const messageId = data?.request_id ?? data?.data?.request_id ?? data?.message_id ?? null;
    return { sent: true as const, messageId: messageId ? String(messageId) : undefined };
  } catch (err) {
    console.error("MSG91 session message send failed", err);
    return { sent: false as const, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Login OTP — one variable (the code). */
export async function sendOtpViaMsg91(phone: string, code: string) {
  const flowSlug = await getSetting("MSG91_OTP_TEMPLATE_ID");
  const result = await sendMsg91Flow(flowSlug, phone, [code]);
  return result.sent;
}
