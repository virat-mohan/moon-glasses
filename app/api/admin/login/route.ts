import { NextResponse } from "next/server";

async function expectedToken(password: string) {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return NextResponse.json({ error: "Admin is not configured — set ADMIN_PASSWORD in Vercel" }, { status: 503 });
  }
  if (body?.password !== password) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const token = await expectedToken(password);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_auth", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
