import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { extractPaymentFromScreenshot, type ExtractedPayment } from "@/lib/payment-screenshot";
import { confirmUpiOrderPayment } from "@/lib/upi-payment";

/**
 * Auto-detects a raw UPI QR payment from a screenshot a customer sends to
 * the WhatsApp Business number, and triggers the exact same fulfillment
 * path as the admin's manual "Mark Paid" button (confirmUpiOrderPayment) —
 * but ONLY when three independent things line up:
 *   1. the sender's phone matches exactly ONE unpaid pending UPI order,
 *   2. the extracted amount matches that order's total,
 *   3. the extracted UTR has never been used before (no replay).
 * Anything less certain is logged for a human to confirm manually instead
 * of guessed at — a screenshot alone is never proof of payment. Every
 * attempt, matched or not, is written to whatsapp_payment_confirmations
 * for audit.
 */

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

async function downloadImage(mediaUrl: string): Promise<{ base64: string; mediaType: string } | null> {
  try {
    const authKey = await getSetting("MSG91_AUTH_KEY");
    const res = await fetch(mediaUrl, authKey ? { headers: { authkey: authKey } } : undefined);
    if (!res.ok) {
      console.error("payment-auto-confirm: failed to download media", mediaUrl, res.status);
      return null;
    }
    const contentType = res.headers.get("content-type") ?? "";
    const mediaType = contentType.startsWith("image/") ? contentType.split(";")[0] : "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    return { base64: buffer.toString("base64"), mediaType };
  } catch (err) {
    console.error("payment-auto-confirm: error downloading media", mediaUrl, err);
    return null;
  }
}

async function logAttempt(input: {
  conversationMessageId: string | null;
  phone: string;
  mediaUrl: string | null;
  extracted: ExtractedPayment | null;
  matchedOrderId: string | null;
  matchStatus: "auto_confirmed" | "needs_review" | "no_match" | "not_a_payment_screenshot" | "extraction_failed";
  note: string;
}) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("whatsapp_payment_confirmations").insert({
    conversation_message_id: input.conversationMessageId,
    phone: input.phone,
    media_url: input.mediaUrl,
    extracted_amount_rupees: input.extracted?.amountRupees ?? null,
    extracted_utr: input.extracted?.utr ?? null,
    extracted_payee: input.extracted?.payee ?? null,
    extracted_raw: input.extracted ?? null,
    matched_order_id: input.matchedOrderId,
    match_status: input.matchStatus,
    note: input.note,
  });
  if (error) console.error("payment-auto-confirm: failed to log attempt", input.matchStatus, error);
}

export async function processInboundPaymentScreenshot(input: {
  phone: string;
  mediaUrl: string;
  conversationMessageId: string | null;
}) {
  const normalizedPhone = normalizePhone(input.phone);

  const image = await downloadImage(input.mediaUrl);
  if (!image) {
    await logAttempt({
      conversationMessageId: input.conversationMessageId,
      phone: input.phone,
      mediaUrl: input.mediaUrl,
      extracted: null,
      matchedOrderId: null,
      matchStatus: "extraction_failed",
      note: "Could not download the image from the provider's media URL.",
    });
    return;
  }

  let extracted: ExtractedPayment;
  try {
    extracted = await extractPaymentFromScreenshot(image.base64, image.mediaType);
  } catch (err) {
    console.error("payment-auto-confirm: extraction failed", err);
    await logAttempt({
      conversationMessageId: input.conversationMessageId,
      phone: input.phone,
      mediaUrl: input.mediaUrl,
      extracted: null,
      matchedOrderId: null,
      matchStatus: "extraction_failed",
      note: err instanceof Error ? err.message : "Unknown extraction error",
    });
    return;
  }

  if (!extracted.isPaymentScreenshot) {
    await logAttempt({
      conversationMessageId: input.conversationMessageId,
      phone: input.phone,
      mediaUrl: input.mediaUrl,
      extracted,
      matchedOrderId: null,
      matchStatus: "not_a_payment_screenshot",
      note: "Claude did not identify this as a payment screenshot.",
    });
    return;
  }

  const supabase = getSupabaseServerClient();

  // Every unpaid UPI QR order is a candidate — filtered by phone in JS
  // since customer_phone is stored however the checkout form was typed
  // (no fixed format to match in SQL reliably).
  const { data: pendingOrders } = await supabase
    .from("orders")
    .select("id, total, customer_phone, upi_utr")
    .eq("payment_type", "upi_qr")
    .eq("payment_status", "unpaid");

  const candidates = (pendingOrders ?? []).filter((o) => normalizePhone(o.customer_phone ?? "") === normalizedPhone);

  if (candidates.length === 0) {
    await logAttempt({
      conversationMessageId: input.conversationMessageId,
      phone: input.phone,
      mediaUrl: input.mediaUrl,
      extracted,
      matchedOrderId: null,
      matchStatus: "no_match",
      note: "No unpaid UPI QR order found for this phone number.",
    });
    return;
  }

  const amountMatches = extracted.amountRupees != null ? candidates.filter((o) => Math.round(o.total) === Math.round(extracted.amountRupees!)) : [];

  if (amountMatches.length !== 1 || !extracted.utr) {
    const note =
      candidates.length > 1 && amountMatches.length !== 1
        ? `${candidates.length} pending orders for this phone, ${amountMatches.length} match the extracted amount — ambiguous.`
        : !extracted.utr
          ? "No UTR/transaction reference could be read from the screenshot."
          : "Extracted amount did not match the pending order's total.";
    await logAttempt({
      conversationMessageId: input.conversationMessageId,
      phone: input.phone,
      mediaUrl: input.mediaUrl,
      extracted,
      matchedOrderId: amountMatches[0]?.id ?? null,
      matchStatus: "needs_review",
      note,
    });
    return;
  }

  const order = amountMatches[0];

  // Dedupe — the same screenshot/UTR must never confirm a second order.
  // This check-then-write has a narrow race window (two screenshots for
  // different orders claiming the same UTR at almost the same instant), so
  // the actual guarantee is the database's unique index on upi_utr, not
  // this read — the write below is what's actually trusted.
  const { data: utrClash } = await supabase.from("orders").select("id").eq("upi_utr", extracted.utr).maybeSingle();
  if (utrClash) {
    await logAttempt({
      conversationMessageId: input.conversationMessageId,
      phone: input.phone,
      mediaUrl: input.mediaUrl,
      extracted,
      matchedOrderId: order.id,
      matchStatus: "needs_review",
      note: `Extracted UTR ${extracted.utr} was already used on order ${utrClash.id} — possible replay.`,
    });
    return;
  }

  // All three checks passed — claim the UTR first. If a concurrent request
  // won the race and already claimed it, the unique index rejects this
  // write and we fall back to needs_review instead of fulfilling twice.
  const { error: claimError } = await supabase
    .from("orders")
    .update({ upi_utr: extracted.utr })
    .eq("id", order.id)
    .is("upi_utr", null);
  if (claimError) {
    await logAttempt({
      conversationMessageId: input.conversationMessageId,
      phone: input.phone,
      mediaUrl: input.mediaUrl,
      extracted,
      matchedOrderId: order.id,
      matchStatus: "needs_review",
      note: `Could not claim UTR ${extracted.utr} — likely a concurrent duplicate. ${claimError.message}`,
    });
    return;
  }
  await confirmUpiOrderPayment(order.id);
  await logAttempt({
    conversationMessageId: input.conversationMessageId,
    phone: input.phone,
    mediaUrl: input.mediaUrl,
    extracted,
    matchedOrderId: order.id,
    matchStatus: "auto_confirmed",
    note: "Phone, amount, and UTR all matched — auto-confirmed.",
  });
}
