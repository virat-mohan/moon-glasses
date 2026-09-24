import { NextResponse } from "next/server";
import { getRecentPostPerformance } from "@/lib/instagram";

/** Read-only proof the connection works: the account's latest posts with reach/engagement. */
export async function GET() {
  try {
    return NextResponse.json({ posts: await getRecentPostPerformance(6) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not load posts" }, { status: 400 });
  }
}
