import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { refreshInstagramTokenIfNeeded } from "@/lib/instagram-connection";

async function assertAuthorized(request: Request) {
  const secret = await getSetting("CRON_SECRET");
  if (!secret) return true;
  const provided = new URL(request.url).searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  return provided === secret;
}

/** Daily: keeps the one-click Instagram connection alive (its token would otherwise lapse after 60 days). */
export async function GET(request: Request) {
  if (!(await assertAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await refreshInstagramTokenIfNeeded());
  } catch (err) {
    console.error("Instagram token refresh failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Refresh failed" }, { status: 500 });
  }
}
