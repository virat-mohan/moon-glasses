import { NextResponse } from "next/server";
import { launchBriefCampaign } from "@/lib/ad-brief-publish";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const result = await launchBriefCampaign(body.id, {
      dailyBudgetRupees: body.dailyBudgetRupees ?? 500,
      cta: body.cta || undefined,
      targeting:
        body.ageMin || body.ageMax || body.gender
          ? { ageMin: body.ageMin, ageMax: body.ageMax, gender: body.gender }
          : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to launch Meta campaign", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not launch campaign" },
      { status: 500 }
    );
  }
}
