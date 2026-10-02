import { getSupabaseServerClient } from "@/lib/supabase";
import { confirmUpiOrderPayment } from "@/lib/upi-payment";

export const BANK_SMS_TOKEN_KEY = "BANK_SMS_WEBHOOK_TOKEN";

/**
 * Pulls the credited amount (in paise) and UPI reference out of a bank credit
 * SMS or alert email (same webhook; the Gmail Apps Script posts the email body). Written loosely so HDFC/ICICI/SBI/Axis phrasings all parse
 * ("Rs.1499.37 credited…", "INR 1,499.37 received…", "₹1499.37 deposited…").
 * Anything that reads as a debit returns null so it can never confirm an order.
 */
export function parseBankCreditSms(
  text: string
): { amountPaise: number; upiRef: string | null; payerName: string | null } | null {
  const t = text.replace(/\s+/g, " ");
  if (/\bdebited\b|\bspent\b|\bwithdrawn\b|\bsent\b/i.test(t) && !/\bcredited\b|\breceived\b/i.test(t)) return null;
  if (!/\bcredited\b|\breceived\b|\bdeposited\b/i.test(t)) return null;
  const amount = t.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!amount) return null;
  const amountPaise = Math.round(parseFloat(amount[1].replace(/,/g, "")) * 100);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) return null;
  const ref =
    t.match(/reference\s*(?:no\.?|number)?\s*(?:is)?\s*[:\-]?\s*(\d{9,14})/i) ??
    t.match(/(?:upi(?:\s*ref(?:erence)?\.?\s*(?:no\.?|number)?)?|ref\.?\s*no\.?|rrn)\s*[:\-]?\s*\(?\s*(\d{9,14})/i);
  // HDFC's email names the payer ("Sender: JOHN DOE (VPA: …)"); the SMS doesn't.
  const payer = t.match(/sender\s*:\s*([A-Za-z][A-Za-z .']{1,60}?)\s*\(/i);
  return { amountPaise, upiRef: ref?.[1] ?? null, payerName: payer?.[1]?.trim() ?? null };
}

/** Matches a credit SMS to the one unpaid UPI order with that exact amount and confirms it. */
export async function handleBankSms(body: string) {
  const supabase = getSupabaseServerClient();
  const parsed = parseBankCreditSms(body);
  const log = (status: string, extra: Record<string, unknown> = {}) =>
    supabase.from("bank_sms_log").insert({
      // Only credit SMS text is kept; anything else (OTPs, debits) is dropped.
      // Only credit SMS text is kept in full; for anything unreadable keep just
      // the first 80 characters (digits masked) to diagnose phone set-up.
      body: parsed ? body.slice(0, 1000) : `(unreadable) ${body.slice(0, 80).replace(/\d/g, "#")}`,
      amount_paise: parsed?.amountPaise ?? null,
      upi_ref: parsed?.upiRef ?? null,
      payer_name: parsed?.payerName ?? null,
      status,
      ...extra,
    });

  if (!parsed) {
    await log("not_a_credit");
    return { status: "not_a_credit" as const };
  }

  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: amountMatches } = await supabase
    .from("orders")
    .select("id, customer_name").eq("is_test", false)
    .eq("payment_type", "upi_qr")
    .neq("payment_status", "paid")
    .eq("upi_amount_paise", parsed.amountPaise)
    .gte("created_at", since)
    // A payment can only be for an order that already existed when it landed.
    .lte("created_at", new Date().toISOString());

  // The exact amount is the match. The payer's name only breaks a tie, since
  // UPI shows the account holder, who is often a family member, not the buyer.
  let candidates = amountMatches ?? [];
  if (candidates.length > 1 && parsed.payerName) {
    const words = parsed.payerName.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    const byName = candidates.filter((c) =>
      String(c.customer_name ?? "")
        .toLowerCase()
        .split(/\s+/)
        .some((w) => words.includes(w))
    );
    if (byName.length === 1) candidates = byName;
  }

  if (candidates.length !== 1) {
    if (!candidates.length) {
      // The same payment often arrives twice (SMS and email): if an order with
      // this exact amount was just confirmed, say so rather than "no match".
      const { data: paid } = await supabase
        .from("orders")
        .select("id").eq("is_test", false)
        .eq("payment_type", "upi_qr")
        .eq("payment_status", "paid")
        .eq("upi_amount_paise", parsed.amountPaise)
        .gte("created_at", since)
        .limit(1);
      if (paid?.length) {
        await log("already_confirmed", { matched_order_id: paid[0].id });
        return { status: "already_confirmed" as const };
      }
    }
    const status = candidates.length ? "ambiguous" : "no_match";
    await log(status);
    return { status };
  }

  const orderId = candidates[0].id as string;
  await confirmUpiOrderPayment(orderId);
  await log("confirmed", { matched_order_id: orderId });
  return { status: "confirmed" as const, orderId };
}
