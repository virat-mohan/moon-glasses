import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { runAdAgentSweep } from "@/lib/ad-agent";

async function assertAuthorized(request: Request) {
  const secret = await getSetting("CRON_SECRET");
  if (!secret) return true;
  const provided = new URL(request.url).searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  return provided === secret;
}

export async function GET(request: Request) {
  if (!(await assertAuthorized(request))) {
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
