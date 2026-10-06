import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runReviewReminders } from "@/lib/review-reminder";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isCronAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runReviewReminders());
  } catch (err) {
    console.error("Review reminder sweep failed", err);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}
