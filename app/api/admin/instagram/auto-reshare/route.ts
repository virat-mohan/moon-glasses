import { NextResponse } from "next/server";
import { setSetting } from "@/lib/settings";
import { isAutoReshareOn } from "@/lib/tagged-reshare";

export async function GET() {
  return NextResponse.json({ enabled: await isAutoReshareOn() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "Missing enabled (true/false)" }, { status: 400 });
  }
  await setSetting("AUTO_RESHARE_TAGS", body.enabled ? "true" : "false");
  return NextResponse.json({ enabled: body.enabled });
}
