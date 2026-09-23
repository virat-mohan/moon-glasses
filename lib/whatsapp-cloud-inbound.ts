import crypto from "crypto";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { logInboundWhatsAppMessage } from "@/lib/whatsapp-inbox";
import { processInboundPaymentScreenshot } from "@/lib/payment-auto-confirm";

const GRAPH = "https://graph.facebook.com/v21.0";
export const WHATSAPP_MEDIA_BUCKET = "whatsapp-media";
export const STORAGE_REF_PREFIX = "storage://";

/** Meta signs every webhook body with the app secret (X-Hub-Signature-256: sha256=<hex>). */
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  if (!/^[0-9a-f]{64}$/i.test(provided)) return false;
  return crypto.timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
}

type CloudMessage = {
  id: string;
  from: string;
  type: string;
  text?: { body?: string };
  image?: { id: string; mime_type?: string; caption?: string };
  document?: { id: string; mime_type?: string; caption?: string; filename?: string };
};

type CloudChangeValue = {
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
  messages?: CloudMessage[];
};

/**
 * Meta's media URLs expire within minutes and need the access token to
 * fetch, so the image is downloaded once here and copied into a PRIVATE
 * bucket (payment screenshots carry UTRs and names) — admin views it via a
 * short-lived signed URL, never a public link.
 */
async function fetchAndStoreMedia(mediaId: string, messageId: string) {
  const token = await getSetting("META_WHATSAPP_ACCESS_TOKEN");
  if (!token) throw new Error("META_WHATSAPP_ACCESS_TOKEN is not set");

  const metaRes = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!metaRes.ok) throw new Error(`Media lookup failed: ${metaRes.status} ${await metaRes.text()}`);
  const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
  if (!meta.url) throw new Error("Media lookup returned no URL");

  const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!fileRes.ok) throw new Error(`Media download failed: ${fileRes.status}`);
  const bytes = Buffer.from(await fileRes.arrayBuffer());
  const mediaType = (meta.mime_type ?? fileRes.headers.get("content-type") ?? "image/jpeg").split(";")[0];

  const ext = mediaType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const path = `inbound/${messageId}.${ext}`;
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.storage
    .from(WHATSAPP_MEDIA_BUCKET)
    .upload(path, bytes, { contentType: mediaType, upsert: true });
  if (error) throw error;

  return { storageRef: `${STORAGE_REF_PREFIX}${WHATSAPP_MEDIA_BUCKET}/${path}`, base64: bytes.toString("base64"), mediaType };
}

async function alreadyProcessed(messageId: string) {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("whatsapp_conversation_messages")
    .select("id")
    .eq("provider_message_id", messageId)
    .maybeSingle();
  return !!data;
}

async function handleMessage(msg: CloudMessage, value: CloudChangeValue, signatureVerified: boolean) {
  // Meta retries any delivery it thinks failed — the same message must
  // never create a second inbox row or a second confirmation attempt.
  if (await alreadyProcessed(msg.id)) return;

  const name = value.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name ?? null;
  const media =
    msg.type === "image" && msg.image
      ? msg.image
      : msg.type === "document" && msg.document?.mime_type?.startsWith("image/")
        ? msg.document
        : null;

  const text =
    msg.text?.body ??
    media?.caption ??
    (media || msg.type === "text" ? "" : `(unsupported message type: ${msg.type})`);

  let stored: Awaited<ReturnType<typeof fetchAndStoreMedia>> | null = null;
  let mediaError: string | null = null;
  if (media) {
    try {
      stored = await fetchAndStoreMedia(media.id, msg.id);
    } catch (err) {
      mediaError = err instanceof Error ? err.message : "Unknown media error";
      console.error("whatsapp-cloud-inbound: media fetch failed", msg.id, err);
    }
  }

  const { messageId } = await logInboundWhatsAppMessage({
    phone: msg.from,
    body: text || (media ? "(image)" : ""),
    customerName: name,
    mediaUrl: stored?.storageRef ?? null,
    providerMessageId: msg.id,
  });

  if (!media) return;

  if (!stored) {
    // Still surface it for manual review rather than silently losing a claimed payment.
    const supabase = getSupabaseServerClient();
    await supabase.from("whatsapp_payment_confirmations").insert({
      conversation_message_id: messageId,
      phone: msg.from,
      media_url: null,
      match_status: "extraction_failed",
      note: `Could not download the image from Meta: ${mediaError}`,
    });
    return;
  }

  await processInboundPaymentScreenshot({
    phone: msg.from,
    mediaUrl: stored.storageRef,
    conversationMessageId: messageId,
    image: { base64: stored.base64, mediaType: stored.mediaType },
    autoConfirmAllowed: signatureVerified,
  });
}

/** Handles a `whatsapp_business_account` webhook body. Delivery/read status updates are ignored — only customer messages matter here. */
export async function handleWhatsAppCloudWebhook(body: { entry?: { changes?: { field?: string; value?: CloudChangeValue }[] }[] }, signatureVerified: boolean) {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages" || !change.value?.messages) continue;
      for (const msg of change.value.messages) {
        try {
          await handleMessage(msg, change.value, signatureVerified);
        } catch (err) {
          console.error("whatsapp-cloud-inbound: failed to handle message", msg.id, err);
        }
      }
    }
  }
}
