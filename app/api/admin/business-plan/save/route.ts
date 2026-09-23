import { NextResponse } from "next/server";
import { computePlanFromDrivers, saveBusinessPlan, type BusinessPlanDrivers } from "@/lib/business-plan";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const quarterStart: string | undefined = body?.quarterStart;
  const drivers: BusinessPlanDrivers | undefined = body?.drivers;
  if (!quarterStart || !drivers) {
    return NextResponse.json({ error: "Missing quarterStart or drivers" }, { status: 400 });
  }

  try {
    // Re-run the SAME deterministic function the client used to preview the
    // edit — this response is the source of truth the UI reconciles to,
    // never trusting the client's own math for what gets stored/displayed.
    const computed = computePlanFromDrivers(drivers);
    await saveBusinessPlan(quarterStart, drivers);
    return NextResponse.json({ drivers, computed });
  } catch (err) {
    console.error("Failed to save business plan", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save business plan" },
      { status: 500 }
    );
  }
}
