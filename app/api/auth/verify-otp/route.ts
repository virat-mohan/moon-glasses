import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyOtp, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if ((!body?.phone && !body?.email) || !body?.code) {
    return NextResponse.json({ error: "Missing phone/email or code" }, { status: 400 });
  }

  try {
    const result = await verifyOtp(body.phone || null, body.email || null, body.code);
    if (!result) {
      return NextResponse.json({ error: "That code is wrong or has expired" }, { status: 400 });
    }

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return NextResponse.json({ ok: true, isNewCustomer: result.isNewCustomer });
  } catch (err) {
    console.error("Failed to verify OTP", err);
    return NextResponse.json({ error: "Could not verify code" }, { status: 500 });
  }
}
