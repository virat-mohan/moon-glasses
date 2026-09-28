import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runWinbackSweep } from "@/lib/winback";

export async function GET(request: Request) {
  if (!(await isCronAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runWinbackSweep();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Win-back sweep failed", err);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}
