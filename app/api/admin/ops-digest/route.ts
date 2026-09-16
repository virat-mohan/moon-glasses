import { NextResponse } from "next/server";
import { computeOpsDigest } from "@/lib/ops-digest";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  try {
    const sinceIso = from ? new Date(`${from}T00:00:00`).toISOString() : undefined;
    // "to" is inclusive of that whole day, so the exclusive upper bound is the next day.
    const untilIso = to ? new Date(new Date(`${to}T00:00:00`).getTime() + 24 * 60 * 60 * 1000).toISOString() : undefined;

    const digest = await computeOpsDigest(sinceIso, untilIso);
    return NextResponse.json(digest);
  } catch (err) {
    console.error("Failed to compute ops digest", err);
    return NextResponse.json({ error: "Could not load digest" }, { status: 500 });
  }
}
