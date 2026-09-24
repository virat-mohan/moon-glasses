import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { handleIncomingMessage, handleIncomingComment } from "@/lib/meta-bot";
import { handleWhatsAppCloudWebhook, verifyMetaSignature } from "@/lib/whatsapp-cloud-inbound";
import { logWebhookRequest } from "@/lib/webhook-log";
import { getInstagramApp } from "@/lib/instagram-connection";
import { handleInstagramDetectionWebhook } from "@/lib/barter-post-detection";

/**
 * Meta calls GET once, when you click "Verify and Save" on the webhook
 * subscription in the App Dashboard, to prove this URL is really yours.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = await getSetting("META_WEBHOOK_VERIFY_TOKEN");
  if (mode === "subscribe" && token && expected && token === expected) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/**
 * Handles inbound Instagram DMs/comments and Facebook Messenger events.
 * Payload shapes follow Meta's documented webhook format, but haven't been
 * exercised against a live subscription yet — this needs a real test send
 * once App Review clears and the webhook is actually subscribed, and the
 * field names below may need adjusting against what Meta actually sends.
 * Always returns 200 quickly — Meta retries aggressively on non-200s, and
 * we don't want a downstream failure (e.g. a bad Graph API call) to cause
 * duplicate deliveries of the same event.
 */
export async function POST(request: Request) {
  // Raw text first — the signature is computed over the exact bytes Meta sent.
  const rawBody = await request.text();

  // With the app secret set, anything not signed by Meta is rejected
  // outright. Without it, requests are still processed (so setup can be
  // tested), but WhatsApp screenshots can never auto-confirm a payment.
  // Facebook-login webhooks (WhatsApp, Messenger) are signed with the Meta
  // app secret; Instagram-Login webhooks with the Instagram app secret.
  const [metaSecret, igApp] = await Promise.all([getSetting("META_APP_SECRET"), getInstagramApp().catch(() => null)]);
  const secrets = [metaSecret, igApp?.appSecret].filter((x): x is string => !!x);
  const signature = request.headers.get("x-hub-signature-256");
  const signatureVerified = secrets.some((secret) => verifyMetaSignature(rawBody, signature, secret));
  if (secrets.length > 0 && !signatureVerified) {
    await logWebhookRequest("meta", "rejected_bad_signature", rawBody);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  type MetaWebhookBody = {
    object?: string;
    entry?: {
      messaging?: { sender?: { id?: string }; message?: { text?: string; is_echo?: boolean } }[];
      changes?: {
        field?: string;
        value?: { id?: string; text?: string; message?: string; from?: { id?: string } };
      }[];
    }[];
  };
  let body: MetaWebhookBody | null = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    body = null;
  }
  if (!body?.object || !Array.isArray(body?.entry)) {
    await logWebhookRequest("meta", "unrecognized", rawBody);
    return NextResponse.json({ ok: true });
  }

  await logWebhookRequest("meta", signatureVerified ? `received:${body.object}` : `received_unverified:${body.object}`, rawBody);

  if (body.object === "whatsapp_business_account") {
    try {
      await handleWhatsAppCloudWebhook(JSON.parse(rawBody), signatureVerified);
    } catch (err) {
      console.error("WhatsApp Cloud webhook handling failed", err);
    }
    return NextResponse.json({ ok: true });
  }

  if (body.object === "instagram" && signatureVerified) {
    try {
      await handleInstagramDetectionWebhook(JSON.parse(rawBody));
    } catch (err) {
      console.error("Instagram post detection failed", err);
    }
  }

  const platform: "instagram" | "facebook" = body.object === "instagram" ? "instagram" : "facebook";

  try {
    for (const entry of body.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        const senderId = event.sender?.id;
        const text = event.message?.text;
        // Ignore echoes of our own outbound sends and non-text events (attachments only, etc).
        if (!senderId || !text || event.message?.is_echo) continue;
        await handleIncomingMessage(platform, senderId, text);
      }

      for (const change of entry.changes ?? []) {
        if (change.field !== "comments" && change.field !== "feed") continue;
        const value = change.value ?? {};
        const commentId = value.id;
        const commentText = value.text ?? value.message;
        const fromId = value.from?.id;
        if (!commentId || !commentText || !fromId) continue;
        await handleIncomingComment(platform, commentId, fromId, commentText);
      }
    }
  } catch (err) {
    console.error("Meta webhook handling failed", err);
  }

  return NextResponse.json({ ok: true });
}
