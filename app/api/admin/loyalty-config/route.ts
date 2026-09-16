import { NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings";

export async function GET() {
  const [milesPerCap, threshold, value] = await Promise.all([
    getSetting("MILES_PER_CAP"),
    getSetting("MILES_REDEMPTION_THRESHOLD"),
    getSetting("MILES_REDEMPTION_VALUE_RUPEES"),
  ]);
  return NextResponse.json({
    milesPerCap: milesPerCap ? Number(milesPerCap) : 100,
    redemptionThreshold: threshold ? Number(threshold) : 500,
    redemptionValueRupees: value ? Number(value) : 100,
  });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Missing body" }, { status: 400 });

  try {
    if (body.milesPerCap != null) await setSetting("MILES_PER_CAP", String(body.milesPerCap));
    if (body.redemptionThreshold != null)
      await setSetting("MILES_REDEMPTION_THRESHOLD", String(body.redemptionThreshold));
    if (body.redemptionValueRupees != null)
      await setSetting("MILES_REDEMPTION_VALUE_RUPEES", String(body.redemptionValueRupees));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to save loyalty config", err);
    return NextResponse.json({ error: "Could not save loyalty config" }, { status: 500 });
  }
}
