import { NextResponse } from "next/server";
import { logTrackingEvent, type TrackingEventName } from "@/lib/tracking";

const VALID_EVENTS: TrackingEventName[] = [
  "PageView",
  "ViewContent",
  "AddToCart",
  "InitiateCheckout",
  "Purchase",
];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.eventName || !VALID_EVENTS.includes(body.eventName)) {
    return NextResponse.json({ error: "Invalid eventName" }, { status: 400 });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  await logTrackingEvent(body.eventName, {
    sessionKey: body.sessionKey,
    chapterSlug: body.chapterSlug,
    value: body.value,
    path: typeof body.path === "string" ? body.path.slice(0, 500) : undefined,
    referrerHost: typeof body.referrerHost === "string" ? body.referrerHost.slice(0, 200) : undefined,
    adBriefId: typeof body.adBriefId === "string" && UUID_RE.test(body.adBriefId) ? body.adBriefId : undefined,
    utmSource: typeof body.utmSource === "string" ? body.utmSource.slice(0, 100) : undefined,
  });

  return NextResponse.json({ ok: true });
}
