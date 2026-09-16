import { NextResponse } from "next/server";
import { computeDailyAdReport } from "@/lib/roas-report";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  try {
    const sinceIso = from
      ? new Date(`${from}T00:00:00`).toISOString()
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const untilIso = to
      ? new Date(new Date(`${to}T00:00:00`).getTime() + 24 * 60 * 60 * 1000).toISOString()
      : new Date().toISOString();

    const report = await computeDailyAdReport(sinceIso, untilIso);
    return NextResponse.json(report);
  } catch (err) {
    console.error("Failed to compute daily ad report", err);
    return NextResponse.json({ error: "Could not load daily report" }, { status: 500 });
  }
}
