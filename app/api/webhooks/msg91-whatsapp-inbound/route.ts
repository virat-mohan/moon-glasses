import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { logInboundWhatsAppMessage } from "@/lib/whatsapp-inbox";
import { processInboundPaymentScreenshot } from "@/lib/payment-auto-confirm";
import { logWebhookRequest } from "@/lib/webhook-log";
import { statusesFromWebhook } from "@/lib/whatsapp-window";
import { getSupabaseServerClient } from "@/lib/supabase";
import { parseWhatsAppOrder, looksLikeOrderPayload, safeStringify, syntheticOrderMessageId } from "@/lib/wa-order";
import { handleWaCartMessage, handleWaPendingText } from "@/lib/wa-flow";
import { replyWithPwapPost, wantsPwapPost } from "@/lib/pwap-whatsapp-reply";

/**
 * MSG91's inbound-WhatsApp webhook — configure this URL under MSG91
 * dashboard → WhatsApp → Settings → Webhook (separate from the DLR/status
 * webhook at /api/webhooks/msg91). Exact payload field names haven't been
 * verified against a live incoming message yet — this reads defensively
 * across a few plausible shapes (a flat object, or a Cloud-API-style
 * `messages[]` array, which MSG91 sometimes mirrors) and logs the raw body
 * on anything unrecognized so the first real message is easy to diagnose.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const expectedToken = await getSetting("MSG91_INBOUND_WEBHOOK_TOKEN");
  const providedToken = request.headers.get("x-webhook-token") ?? new URL(request.url).searchParams.get("token");
  if (expectedToken && providedToken !== expectedToken) {
    await logWebhookRequest("msg91-inbound", "rejected_bad_token", rawBody);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, any> | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any -- provider payload shape is unverified, read defensively below
  try {
    body = JSON.parse(rawBody);
  } catch {
    const form = new URLSearchParams(rawBody);
    body = form.size > 0 ? Object.fromEntries(form) : null;
  }
  await logWebhookRequest("msg91-inbound", body ? "received" : "unparseable", rawBody);
  if (!body) return NextResponse.json({ ok: true });

  // Some BSPs (and MSG91, per their docs) wrap inbound events in a
  // Cloud-API-style `messages` array alongside a `contacts` array for the
  // sender's name — unwrap that first if present, otherwise treat the body
  // itself as the single message.
  // MSG91 sends `messages` as a JSON *string*; parse it if so.
  if (typeof body.messages === "string") {
    try {
      body.messages = JSON.parse(body.messages);
    } catch {
      // leave as-is
    }
  }
  // Delivery/read statuses for our replies: update the stored message and stop.
  const statuses = statusesFromWebhook(body);
  if (statuses.length) {
    const supabase = getSupabaseServerClient();
    for (const st of statuses) {
      await supabase
        .from("whatsapp_conversation_messages")
        .update({ status: st.status })
        .eq("provider_message_id", st.providerMessageId)
        .eq("direction", "outbound");
    }
    return NextResponse.json({ ok: true });
  }

  const msg = Array.isArray(body.messages) ? body.messages[0] : body;
  const contact = Array.isArray(body.contacts) ? body.contacts[0] : undefined;

  // WhatsApp catalogue cart ("order" message): found anywhere in the payload.
  const waOrder = parseWhatsAppOrder(body);
  const orderUnreadable = !waOrder && looksLikeOrderPayload(body);

  const phone = waOrder?.phone ?? msg?.from ?? msg?.sender ?? msg?.mobile ?? body.customerNumber ?? body.from ?? body.mobile ?? null;
  const textRaw = msg?.text?.body ?? msg?.body ?? msg?.message ?? body.text ?? null;
  // Inbox body: a readable line for a cart; the raw payload (truncated) when an order-looking message could not be read, so it can be inspected.
  const text: string | null = waOrder
    ? `[WhatsApp cart] ${waOrder.items.map((i) => `${i.qty}× ${i.retailerId}`).join(", ") || "no items"}`
    : orderUnreadable
      ? `[unrecognised order payload] ${safeStringify(body)}`
      : textRaw;
  const name = contact?.profile?.name ?? msg?.name ?? body.customerName ?? body.name ?? null;
  const mediaUrl = msg?.image?.link ?? msg?.media?.url ?? body.media_url ?? null;
  const providerMessageId =
    waOrder?.messageId ?? msg?.id ?? msg?.message_id ?? body.message_id ?? (waOrder && phone ? syntheticOrderMessageId(String(phone), waOrder.items) : null);

  if (!phone) {
    console.error("MSG91 inbound webhook: unrecognized payload shape", JSON.stringify(body));
    return NextResponse.json({ ok: true });
  }

  if (providerMessageId) {
    const { data: dupe } = await getSupabaseServerClient()
      .from("whatsapp_conversation_messages")
      .select("id")
      .eq("provider_message_id", String(providerMessageId))
      .maybeSingle();
    if (dupe) return NextResponse.json({ ok: true });
  }

  try {
    const { messageId, conversationId } = await logInboundWhatsAppMessage({
      phone: String(phone),
      body: text ?? "",
      customerName: name,
      mediaUrl,
      providerMessageId: providerMessageId ? String(providerMessageId) : null,
    });

    // Cart from the WhatsApp catalogue, or the address for a pending cart. Errors never fail the webhook.
    if (waOrder) {
      await handleWaCartMessage({ ...waOrder, phone: String(phone), name: waOrder.name ?? name }, conversationId).catch((err) =>
        console.error("WhatsApp cart handling failed", err)
      );
    } else if (textRaw && !mediaUrl && !wantsPwapPost(textRaw)) {
      await handleWaPendingText({ phone: String(phone), text: String(textRaw), profileName: name, conversationId }).catch((err) =>
        console.error("WhatsApp address handling failed", err)
      );
    }

    // Awaited (not fire-and-forget) deliberately — on a serverless runtime
    // the process can be frozen/killed right after the response is sent,
    // which would silently drop a payment-critical check. A few extra
    // seconds on the webhook response is the safer trade. Errors are
    // caught and logged inside processInboundPaymentScreenshot itself,
    // never thrown here.
    // "Get my post on WhatsApp": reply with their Pay With A Post image.
    if (wantsPwapPost(textRaw)) {
      await replyWithPwapPost(String(phone), String(textRaw)).catch((err) =>
        console.error("Pay With A Post WhatsApp reply failed", err)
      );
    }

    if (mediaUrl) {
      await processInboundPaymentScreenshot({ phone: String(phone), mediaUrl: String(mediaUrl), conversationMessageId: messageId }).catch(
        (err) => console.error("payment-auto-confirm: unhandled error", err)
      );
    }
  } catch (err) {
    console.error("Failed to log inbound WhatsApp message", err);
  }

  return NextResponse.json({ ok: true });
}
