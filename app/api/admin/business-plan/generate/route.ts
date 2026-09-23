import { NextResponse } from "next/server";
import { generateBusinessPlanDrivers, computePlanFromDrivers, saveBusinessPlan, type PlanSetup } from "@/lib/business-plan";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const quarterStart = body?.quarterStart;
  const setup: PlanSetup | undefined = body?.setup;
  if (!quarterStart || !/^\d{4}-\d{2}-\d{2}$/.test(quarterStart)) {
    return NextResponse.json({ error: "Missing or invalid quarterStart (expected YYYY-MM-DD)" }, { status: 400 });
  }
  if (!setup || !Array.isArray(setup.targetCities) || !setup.shippingPolicy) {
    return NextResponse.json({ error: "Missing setup (targetCities, shippingPolicy)" }, { status: 400 });
  }

  try {
    const drivers = await generateBusinessPlanDrivers(quarterStart, setup);
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
