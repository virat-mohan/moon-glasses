import { getSupabaseServerClient } from "@/lib/supabase";
import { confirmUpiOrderPayment } from "@/lib/upi-payment";

export const BANK_SMS_TOKEN_KEY = "BANK_SMS_WEBHOOK_TOKEN";

/**
 * Pulls the credited amount (in paise) and UPI reference out of a bank credit
 * SMS. Written loosely so HDFC/ICICI/SBI/Axis phrasings all parse
 * ("Rs.1499.37 credited…", "INR 1,499.37 received…", "₹1499.37 deposited…").
 * Anything that reads as a debit returns null so it can never confirm an order.
 */
export function parseBankCreditSms(text: string): { amountPaise: number; upiRef: string | null } | null {
  const t = text.replace(/\s+/g, " ");
  if (/\bdebited\b|\bspent\b|\bwithdrawn\b|\bsent\b/i.test(t) && !/\bcredited\b|\breceived\b/i.test(t)) return null;
  if (!/\bcredited\b|\breceived\b|\bdeposited\b/i.test(t)) return null;
  const amount = t.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!amount) return null;
  const amountPaise = Math.round(parseFloat(amount[1].replace(/,/g, "")) * 100);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) return null;
  const ref = t.match(/(?:upi(?:\s*ref(?:erence)?\.?\s*(?:no\.?|number)?)?|ref\.?\s*no\.?|rrn)\s*[:\-]?\s*\(?\s*(\d{9,14})/i);
  return { amountPaise, upiRef: ref?.[1] ?? null };
}

/** Matches a credit SMS to the one unpaid UPI order with that exact amount and confirms it. */
export async function handleBankSms(body: string) {
  const supabase = getSupabaseServerClient();
  const parsed = parseBankCreditSms(body);
  const log = (status: string, extra: Record<string, unknown> = {}) =>
    supabase.from("bank_sms_log").insert({
      // Only credit SMS text is kept; anything else (OTPs, debits) is dropped.
      body: parsed ? body.slice(0, 1000) : "(not stored: not a credit SMS)",
      amount_paise: parsed?.amountPaise ?? null,
      upi_ref: parsed?.upiRef ?? null,
      status,
      ...extra,
    });

  if (!parsed) {
    await log("not_a_credit");
    return { status: "not_a_credit" as const };
  }

  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: candidates } = await supabase
    .from("orders")
    .select("id")
    .eq("payment_type", "upi_qr")
    .neq("payment_status", "paid")
    .eq("upi_amount_paise", parsed.amountPaise)
    .gte("created_at", since);

  if (!candidates || candidates.length !== 1) {
    const status = candidates?.length ? "ambiguous" : "no_match";
    await log(status);
    return { status };
  }

  const orderId = candidates[0].id as string;
  await confirmUpiOrderPayment(orderId);
  await log("confirmed", { matched_order_id: orderId });
  return { status: "confirmed" as const, orderId };
}
