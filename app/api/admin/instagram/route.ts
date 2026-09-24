import crypto from "crypto";
import { NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings";
import {
  disconnectInstagram,
  getInstagramApp,
  getInstagramConnection,
  getInstagramRedirectUri,
  saveInstagramApp,
} from "@/lib/instagram-connection";

export async function GET() {
  const [app, connection, redirectUri] = await Promise.all([
    getInstagramApp(),
    getInstagramConnection(),
    getInstagramRedirectUri(),
  ]);
  // Admin needs to paste this into Meta's webhook setup, so it's shown (and
  // created on first view) here rather than hidden like other settings.
  let verifyToken = await getSetting("META_WEBHOOK_VERIFY_TOKEN");
  if (!verifyToken) {
    verifyToken = crypto.randomBytes(24).toString("hex");
    await setSetting("META_WEBHOOK_VERIFY_TOKEN", verifyToken);
  }
  const webhookUrl = redirectUri.replace("/api/admin/instagram/callback", "/api/webhooks/meta");
  return NextResponse.json({
    appConfigured: !!app,
    appId: app?.appId ?? null,
    redirectUri,
    webhookUrl,
    verifyToken,
    connection: connection
      ? {
          username: connection.username,
          connectedAt: connection.connectedAt,
          daysLeft: Math.round((new Date(connection.expiresAt).getTime() - Date.now()) / 86_400_000),
        }
      : null,
  });
}

/** Saves the Instagram app ID + secret (one-time, from the Meta app's Instagram login setup). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  try {
    await saveInstagramApp(String(body?.appId ?? ""), String(body?.appSecret ?? ""));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save" }, { status: 400 });
  }
}

export async function DELETE() {
  await disconnectInstagram();
  return NextResponse.json({ ok: true });
}
