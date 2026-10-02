import { NextResponse } from "next/server";
import { sendContactFormEmail } from "@/lib/email";
import { issueFormToken, rateLimited, spamReason } from "@/lib/contact-spam";

export const dynamic = "force-dynamic";

// The form fetches a signed render time on load; submissions under 3s are dropped.
export async function GET() {
  return NextResponse.json({ token: issueFormToken() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Name, email, and message are required" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const reason = rateLimited(ip) ? "rate_limited" : spamReason({ name, message, website: body?.website, token: body?.token });
  if (reason) {
    // No spam table exists yet: log and drop silently, never email.
    console.warn("Contact form spam dropped", { reason, ip });
    return NextResponse.json({ ok: true });
  }

  try {
    await sendContactFormEmail(name, email, message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Contact form send failed", err);
    return NextResponse.json({ error: "Could not send your message" }, { status: 500 });
  }
}
