import { NextResponse } from "next/server";
import { generateBusinessPlanDrivers, computePlanFromDrivers, saveBusinessPlan } from "@/lib/business-plan";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const quarterStart = body?.quarterStart;
  if (!quarterStart || !/^\d{4}-\d{2}-\d{2}$/.test(quarterStart)) {
    return NextResponse.json({ error: "Missing or invalid quarterStart (expected YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const drivers = await generateBusinessPlanDrivers(quarterStart);
    await saveBusinessPlan(quarterStart, drivers);
    return NextResponse.json({ drivers, computed: computePlanFromDrivers(drivers) });
  } catch (err) {
    console.error("Failed to generate business plan", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not generate business plan" },
      { status: 500 }
    );
  }
}
