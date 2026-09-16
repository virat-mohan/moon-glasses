import { NextResponse } from "next/server";
import { generateGrowthRecommendations } from "@/lib/growth-recommendations";

export async function GET() {
  try {
    const recommendations = await generateGrowthRecommendations();
    return NextResponse.json({ recommendations });
  } catch (err) {
    console.error("Failed to generate growth recommendations", err);
    return NextResponse.json({ recommendations: [], error: "Could not generate recommendations" }, { status: 500 });
  }
}
