import { getSupabaseServerClient } from "@/lib/supabase";
import { getRazorpayCredentials } from "@/lib/razorpay";
import { sendEmail } from "@/lib/email";
import { alertHtml, alertSubject, totalOrphans, type OrphanCredit, type OrphanReport } from "@/lib/payment-orphans-core";

export const PAYMENT_ALERT_TO = "founder@viratmohan.com";
const DAY_MS = 24 * 60 * 60 * 1000;

async function razorpayCapturesWithoutOrder(sinceMs: number): Promise<{ checked: boolean; count: number }> {
  const creds = await getRazorpayCredentials();
  if (!creds) return { checked: false, count: 0 };
  try {
    const auth = `Basic ${Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64")}`;
    const from = Math.floor(sinceMs / 1000);
    const res = await fetch(`https://api.razorpay.com/v1/payments?from=${from}&count=100`, { headers: { Authorization: auth } });
    if (!res.ok) return { checked: false, count: 0 };
    const data = await res.json();
    const ids: string[] = (data.items ?? []).filter((p: { status: string }) => p.status === "captured").map((p: { id: string }) => p.id);
    if (!ids.length) return { checked: true, count: 0 };
    const { data: orders } = await getSupabaseServerClient().from("orders").select("razorpay_payment_id").in("razorpay_payment_id", ids);
    const have = new Set((orders ?? []).map((o) => o.razorpay_payment_id as string));
    return { checked: true, count: ids.filter((id) => !have.has(id)).length };
  } catch (err) {
    console.error("Razorpay orphan check failed", err);
    return { checked: false, count: 0 };
  }
}

/** Read-only: counts payments with no order and emails the founder. Never touches orders or messages customers. */
export async function runPaymentOrphanAlert(now = Date.now()) {
  const since = now - DAY_MS;
  const { data: rows, error } = await getSupabaseServerClient()
    .from("bank_sms_log")
    .select("status, payer_name")
    .in("status", ["no_match", "ambiguous"])
    .gte("created_at", new Date(since).toISOString());
  if (error) throw error;
  const credits: OrphanCredit[] = (rows ?? []).map((r) => ({ status: r.status as OrphanCredit["status"], payerName: (r.payer_name as string | null) ?? null }));
  const rz = await razorpayCapturesWithoutOrder(since);
  const report: OrphanReport = { credits, razorpayChecked: rz.checked, razorpayCaptures: rz.count };
  const emailed = await sendEmail(PAYMENT_ALERT_TO, alertSubject(report), alertHtml(report), undefined, { internal: true });
  return { noMatch: credits.filter((c) => c.status === "no_match").length, ambiguous: credits.filter((c) => c.status === "ambiguous").length, razorpayChecked: rz.checked, razorpayCaptures: rz.count, total: totalOrphans(report), emailed };
}
