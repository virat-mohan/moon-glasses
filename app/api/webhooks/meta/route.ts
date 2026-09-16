import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { handleIncomingMessage, handleIncomingComment } from "@/lib/meta-bot";

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
  const body = await request.json().catch(() => null);
  if (!body?.object || !Array.isArray(body?.entry)) {
    return NextResponse.json({ ok: true });
  }

  const platform: "instagram" | "facebook" = body.object === "instagram" ? "instagram" : "facebook";

  try {
    for (const entry of body.entry) {
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
