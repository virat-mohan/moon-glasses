import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { runOpsDigest } from "@/lib/ops-digest";

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
    const result = await runOpsDigest();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Ops digest failed", err);
    return NextResponse.json({ error: "Digest failed" }, { status: 500 });
  }
}
