import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runAdAgentSweep } from "@/lib/ad-agent";

export async function GET(request: Request) {
  if (!(await isCronAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAdAgentSweep();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Ad agent sweep failed", err);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}
