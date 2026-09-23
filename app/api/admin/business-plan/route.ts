import { NextResponse } from "next/server";
import { getBusinessPlan, computePlanFromDrivers } from "@/lib/business-plan";

export async function GET(request: Request) {
  const quarterStart = new URL(request.url).searchParams.get("quarterStart");
  if (!quarterStart) return NextResponse.json({ error: "Missing quarterStart" }, { status: 400 });

  const drivers = await getBusinessPlan(quarterStart);
  if (!drivers) return NextResponse.json({ drivers: null, computed: null });

  return NextResponse.json({ drivers, computed: computePlanFromDrivers(drivers) });
}
