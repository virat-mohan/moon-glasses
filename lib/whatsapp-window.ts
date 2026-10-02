/**
 * Pure rules for the WhatsApp inbox (same pattern as viratmohan.com
 * src/lib/whatsapp-inbox.ts): the 24-hour free-text window, and reading
 * delivery statuses out of an MSG91 webhook body. No I/O here so it is tested.
 */
export const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

type Msg = { direction: string; created_at: string };

/** Free text is allowed only within 24h of the customer's last inbound message. */
export function canReplyFreeForm(msgs: Msg[], now = new Date()): boolean {
  let last = 0;
  for (const m of msgs) {
    if (m.direction !== "inbound") continue;
    const t = Date.parse(m.created_at);
    if (t > last) last = t;
  }
  return last > 0 && now.getTime() - last < SESSION_WINDOW_MS;
}

export type StatusUpdate = { providerMessageId: string; status: "sent" | "delivered" | "read" | "failed" };

function normalise(s: unknown): StatusUpdate["status"] | null {
  const v = String(s ?? "").toLowerCase();
  if (v.includes("read") || v.includes("seen")) return "read";
  if (v.includes("deliver") && !v.includes("undeliver")) return "delivered";
  if (v.includes("fail") || v.includes("undeliver") || v.includes("reject")) return "failed";
  if (v === "sent" || v === "submitted") return "sent";
  return null;
}

/** Status events MSG91 (or a Cloud-API-style mirror) puts on a webhook body. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider payload read defensively
export function statusesFromWebhook(body: any): StatusUpdate[] {
  if (!body || typeof body !== "object") return [];
  let raw = body.statuses;
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { raw = null; }
  }
  const list = Array.isArray(raw) ? raw : [];
  // Flat MSG91 report: { requestId|uuid, status|eventName } with no inbound text.
  if (!list.length && !body.messages && (body.eventName || body.status) && (body.uuid || body.requestId || body.request_id)) {
    list.push({ id: body.uuid ?? body.requestId ?? body.request_id, status: body.eventName ?? body.status });
  }
  const out: StatusUpdate[] = [];
  for (const s of list) {
    const id = s?.id ?? s?.message_id ?? s?.uuid;
    const status = normalise(s?.status ?? s?.eventName);
    if (id && status) out.push({ providerMessageId: String(id), status });
  }
  return out;
}
