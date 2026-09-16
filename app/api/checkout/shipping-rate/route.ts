import { NextResponse } from "next/server";
import { getShippingRate } from "@/lib/shiprocket";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const pincode = String(body?.pincode ?? "").trim();
  const unitCount = Number(body?.unitCount ?? 1);

  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json({ error: "Invalid pincode" }, { status: 400 });
  }

  const result = await getShippingRate(pincode, unitCount || 1);
  if (result.status === "available") {
    return NextResponse.json({ available: true, rate: result.rate });
  }
  // "checked_unavailable" is a real can't-deliver-here result and should
  // read as blocking to the shopper; "not_configured"/"check_failed" are
  // our problem, so surface as "unknown" rather than implying they did
  // something wrong.
  return NextResponse.json({
    available: false,
    blocking: result.status === "checked_unavailable",
  });
}
