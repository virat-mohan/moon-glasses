import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifyOtp } from "@/lib/auth";
import { resolveBarterAccess } from "@/lib/pwap-kits";
import { sessionEmailMatchesOrder } from "@/lib/pwap-sales";

/** Checks the one-time code for the ORDER's email and starts the normal customer session. */
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const wrong = NextResponse.json({ error: "wrong" }, { status: 400 });
  if (!email || !/^\d{6}$/.test(code)) return wrong;

  const found = await resolveBarterAccess(orderId);
  const orderEmail = found?.order.customer_email;
  if (!found || !orderEmail || !sessionEmailMatchesOrder(email, orderEmail)) return wrong;

  try {
    const result = await verifyOtp(null, orderEmail.trim(), code);
    if (!result) return wrong;
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("barter verify-code failed", orderId, err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
