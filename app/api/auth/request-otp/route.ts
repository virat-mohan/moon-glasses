import { NextResponse } from "next/server";
import { requestOtp } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.phone && !body?.email) {
    return NextResponse.json({ error: "Enter a phone number or an email address" }, { status: 400 });
  }

  try {
    await requestOtp(body.phone || null, body.email || null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to send OTP", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not send code" },
      { status: 400 }
    );
  }
}
