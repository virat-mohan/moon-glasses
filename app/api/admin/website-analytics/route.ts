import { NextResponse } from "next/server";
import { computeWebsiteAnalytics } from "@/lib/website-analytics";

// Dates are IST calendar days (the store's day), whatever timezone the server runs in.
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  try {
    if ((from && !DAY_RE.test(from)) || (to && !DAY_RE.test(to))) {
      return NextResponse.json({ error: "Dates must look like 2026-10-03" }, { status: 400 });
    }
    const sinceIso = from
      ? new Date(`${from}T00:00:00+05:30`).toISOString()
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    // "to" is inclusive of that whole day, so the exclusive upper bound is the next day.
    const untilIso = to
      ? new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 24 * 60 * 60 * 1000).toISOString()
      : new Date().toISOString();

    const analytics = await computeWebsiteAnalytics(sinceIso, untilIso);
    return NextResponse.json(analytics);
  } catch (err) {
    console.error("Failed to compute website analytics", err);
    return NextResponse.json({ error: "Could not load analytics" }, { status: 500 });
  }
}
