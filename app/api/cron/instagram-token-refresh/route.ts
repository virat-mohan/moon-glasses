import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { refreshInstagramTokenIfNeeded } from "@/lib/instagram-connection";
import { pollCollabPosts } from "@/lib/barter-post-detection";

/** Hourly: keeps the Instagram connection alive (60-day token) and picks up collaborator posts for Pay With A Post. */
export async function GET(request: Request) {
  if (!(await isCronAuthorized(request))) {
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
