import { NextResponse } from "next/server";
import { requestOtp } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { resolveBarterAccess } from "@/lib/pwap-kits";
import { BARTER_CODE_SENT_MESSAGE, sessionEmailMatchesOrder } from "@/lib/pwap-sales";

/**
 * Sends a one-time code, but only when the typed email is the order's email.
 * The answer is identical either way, so it never reveals whether it matched.
 */
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const reply = NextResponse.json({ ok: true, message: BARTER_CODE_SENT_MESSAGE });
  if (!email || !email.includes("@")) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });

  try {
    const found = await resolveBarterAccess(orderId);
    const orderEmail = found?.order.customer_email;
    if (found && orderEmail && sessionEmailMatchesOrder(email, orderEmail)) {
      // At most one code a minute per email.
      const since = new Date(Date.now() - 60_000).toISOString();
      const { count } = await getSupabaseServerClient()
        .from("otp_codes")
        .select("id", { count: "exact", head: true })
        .eq("email", orderEmail.trim())
        .gte("created_at", since);
      if (!count) await requestOtp(null, orderEmail.trim());
    }
  } catch (err) {
    console.error("barter request-code failed", orderId, err);
  }
  return reply;
}
