import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runPaymentOrphanAlert } from "@/lib/payment-orphans";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isCronAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runPaymentOrphanAlert());
  } catch (err) {
    console.error("Payment orphan alert failed", err);
    return NextResponse.json({ error: "Alert failed" }, { status: 500 });
  }
}
