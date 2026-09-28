import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runOpsDigest } from "@/lib/ops-digest";

export async function GET(request: Request) {
  if (!(await isCronAuthorized(request))) {
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
