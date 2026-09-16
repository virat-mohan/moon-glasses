import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { reviseAdBriefCopy } from "@/lib/ad-brief";

/** Revises an ad brief's copy against a free-text instruction, via Claude — see reviseAdBriefCopy for why this isn't a from-scratch regeneration. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id || !body?.instruction) {
    return NextResponse.json({ error: "Missing id or instruction" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data: brief } = await supabase
      .from("ad_briefs")
      .select("headline, primary_text, cta, target_audience, hashtags")
      .eq("id", body.id)
      .maybeSingle();
    if (!brief) return NextResponse.json({ error: "Brief not found" }, { status: 404 });

    const revised = await reviseAdBriefCopy(
      {
        headline: brief.headline,
        primaryText: brief.primary_text,
        cta: brief.cta,
        targetAudience: brief.target_audience,
        hashtags: brief.hashtags ?? [],
      },
      body.instruction
    );

    const patch = {
      headline: revised.headline,
      primary_text: revised.primaryText,
      cta: revised.cta,
      target_audience: revised.targetAudience,
      hashtags: revised.hashtags,
    };
    const { error } = await supabase.from("ad_briefs").update(patch).eq("id", body.id);
    if (error) throw error;

    return NextResponse.json({ ok: true, brief: patch });
  } catch (err) {
    console.error("Failed to revise ad brief copy", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not revise copy" },
      { status: 500 }
    );
  }
}
