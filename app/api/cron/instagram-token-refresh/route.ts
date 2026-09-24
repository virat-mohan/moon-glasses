import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { refreshInstagramTokenIfNeeded } from "@/lib/instagram-connection";
import { pollCollabPosts } from "@/lib/barter-post-detection";

async function assertAuthorized(request: Request) {
  const secret = await getSetting("CRON_SECRET");
  if (!secret) return true;
  const provided = new URL(request.url).searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  return provided === secret;
}

/** Hourly: keeps the Instagram connection alive (60-day token) and picks up collaborator posts for Pay With A Post. */
export async function GET(request: Request) {
  if (!(await assertAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const refresh = await refreshInstagramTokenIfNeeded();
    const collabs = await pollCollabPosts();
    return NextResponse.json({ refresh, collabs });
  } catch (err) {
    console.error("Instagram token refresh failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Refresh failed" }, { status: 500 });
  }
}
