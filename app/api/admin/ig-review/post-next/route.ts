import { NextResponse } from "next/server";
import { runIgDrip } from "@/lib/ig-drip";

export const maxDuration = 300;

/** Admin button "Post next now": posts the first approved, unposted product regardless of its slot time. */
export async function POST() {
  try {
    return NextResponse.json({ ok: true, ...(await runIgDrip({ force: true })) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
