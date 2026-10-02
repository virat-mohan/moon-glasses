import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { isAutoReshareOn, runTaggedReshare } from "@/lib/tagged-reshare";

export const maxDuration = 300;

/**
 * Every 30 min: anyone who tags @moonglassesonline in a post, or mentions us
 * in a story, gets reshared to our Story (when AUTO_RESHARE_TAGS is on, the
 * default). Max 5 per run, last 7 days only, never twice. See lib/tagged-reshare.ts.
 */
export async function GET(request: Request) {
  if (!(await isCronAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAutoReshareOn())) return NextResponse.json({ ok: true, skipped: "AUTO_RESHARE_TAGS is off" });
  const { results, notes } = await runTaggedReshare();
  return NextResponse.json({ ok: true, results, notes });
}
