import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { scoreCreatorApplication } from "@/lib/creator-scoring";
import { getPublicFollowerCount } from "@/lib/instagram";
import { sendCreatorApplicationReceivedEmail, sendCreatorApplicationNotificationEmail } from "@/lib/email";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const phone = body?.phone ? String(body.phone).trim() : null;
  const instagramHandle = String(body?.instagramHandle ?? "").trim().replace(/^@/, "");
  const category = body?.category ? String(body.category).trim() : null;
  const city = body?.city ? String(body.city).trim() : null;

  if (!name || !email || !instagramHandle) {
    return NextResponse.json({ error: "Name, email, and Instagram handle are required" }, { status: 400 });
  }

  // Picked up server-side from Instagram itself rather than self-reported —
  // see getPublicFollowerCount in lib/instagram.ts. null means it couldn't
  // be verified (e.g. a personal, not Business/Creator, account); the
  // application still goes through, just flagged for manual follow-up.
  const followerCount = await getPublicFollowerCount(instagramHandle);

  const { score, reasons, recommendation } = scoreCreatorApplication({
    followerCount,
    category,
    city,
    instagramHandle,
  });

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("creators")
      .insert({
        name,
        email,
        phone,
        instagram_handle: instagramHandle,
        follower_count: followerCount ?? 0,
        category,
        city,
        score,
        score_reasons: reasons,
        recommendation,
      })
      .select()
      .single();
    if (error) throw error;

    try {
      await Promise.all([
        sendCreatorApplicationReceivedEmail(email, name),
        sendCreatorApplicationNotificationEmail(name, instagramHandle, followerCount ?? 0, score, recommendation),
      ]);
    } catch (notifyErr) {
      console.error("Failed to send creator application emails", notifyErr);
    }

    return NextResponse.json({ ok: true, creatorId: data.id, followerCount });
  } catch (err) {
    console.error("Failed to save creator application", err);
    const message =
      err instanceof Error && err.message.includes("duplicate")
        ? "That Instagram handle has already applied"
        : "Could not save your application";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
