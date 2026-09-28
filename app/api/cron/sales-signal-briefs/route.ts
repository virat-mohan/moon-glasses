import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runSalesSignalBriefSweep } from "@/lib/sales-signal-briefs";

export async function GET(request: Request) {
  if (!(await isCronAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSalesSignalBriefSweep();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Sales-signal brief sweep failed", err);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}
