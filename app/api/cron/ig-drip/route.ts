import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runIgDrip } from "@/lib/ig-drip";

export const maxDuration = 300;

/** Every 15 min: posts the next approved product (first at once, then 6h after the previous actual post), or its story 15 min later. Off unless IG_DRIP_ENABLED is "true". */
export async function GET(request: Request) {
  if (!(await isCronAuthorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await runIgDrip()) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
