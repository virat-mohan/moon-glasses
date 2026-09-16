import { NextResponse } from "next/server";
import { computeWebsiteAnalytics } from "@/lib/website-analytics";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  try {
    const sinceIso = from
      ? new Date(`${from}T00:00:00`).toISOString()
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    // "to" is inclusive of that whole day, so the exclusive upper bound is the next day.
    const untilIso = to
      ? new Date(new Date(`${to}T00:00:00`).getTime() + 24 * 60 * 60 * 1000).toISOString()
      : new Date().toISOString();

    const analytics = await computeWebsiteAnalytics(sinceIso, untilIso);
    return NextResponse.json(analytics);
  } catch (err) {
    console.error("Failed to compute website analytics", err);
    return NextResponse.json({ error: "Could not load analytics" }, { status: 500 });
  }
}
