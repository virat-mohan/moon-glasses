import { NextResponse } from "next/server";
import { getAllSettingsMasked, setSetting, SETTINGS_KEYS, type SettingKey } from "@/lib/settings";
import { getInstagramConnection } from "@/lib/instagram-connection";

export async function GET() {
  const [present, instagram] = await Promise.all([getAllSettingsMasked(), getInstagramConnection().catch(() => null)]);
  return NextResponse.json({ present: { ...present, INSTAGRAM_LOGIN_CONNECTED: !!instagram } });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.key || !SETTINGS_KEYS.includes(body.key)) {
    return NextResponse.json({ error: "Unknown setting key" }, { status: 400 });
  }
  if (!body?.value) {
    return NextResponse.json({ error: "Missing value" }, { status: 400 });
  }

  try {
    await setSetting(body.key as SettingKey, body.value);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to save setting", err);
    return NextResponse.json({ error: "Could not save setting" }, { status: 500 });
  }
}
