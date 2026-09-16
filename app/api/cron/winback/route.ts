import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { runWinbackSweep } from "@/lib/winback";

async function assertAuthorized(request: Request) {
  const secret = await getSetting("CRON_SECRET");
  if (!secret) return true; // not configured yet — allow (dev/manual-trigger friendly)
  const provided = new URL(request.url).searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  return provided === secret;
}

export async function GET(request: Request) {
  if (!(await assertAuthorized(request))) {
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
