import { NextResponse } from "next/server";
import { getShoppingOverview } from "@/lib/instagram-shopping";

export async function GET() {
  try {
    return NextResponse.json(await getShoppingOverview());
  } catch (err) {
    return NextResponse.json({ eligible: false, reason: err instanceof Error ? err.message : "failed", catalogue: null });
  }
}
