import { NextResponse } from "next/server";
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
  return NextResponse.json({
    appConfigured: !!app,
    appId: app?.appId ?? null,
    redirectUri,
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
