import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.sessionKey) {
    return NextResponse.json({ error: "Missing sessionKey" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data: existing } = await supabase
      .from("cart_sessions")
      .select("id, status")
      .eq("session_key", body.sessionKey)
      .maybeSingle();

    // A completed order must never be resurrected into "abandoned" again.
    // But an "abandoned" session getting a fresh save means the shopper is
    // actively back and shopping (possibly with a different cart) — that
    // should go back to "active" so the sweep can pick it up (with the new
    // items) if they abandon again, rather than staying stuck on whatever
    // was true the last time they walked away.
    const status = existing?.status === "converted" ? "converted" : "active";
    // Clear any previous nudge flag when reactivating, so a genuinely new
    // round of abandonment (different cart, later visit) is eligible for
    // its own retargeting message instead of being silently skipped because
    // the session was already nudged once in a prior round.
    const retargetedAt = status === "converted" ? undefined : null;

    const { error } = await supabase.from("cart_sessions").upsert(
      {
        session_key: body.sessionKey,
        customer_name: body.name || null,
        customer_phone: body.phone || null,
        customer_email: body.email || null,
        items: body.items ?? [],
        subtotal: body.subtotal ?? null,
        status,
        ...(retargetedAt !== undefined ? { retargeted_at: retargetedAt } : {}),
        last_activity_at: new Date().toISOString(),
      },
      { onConflict: "session_key" }
    );
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to save cart session", err);
    return NextResponse.json({ error: "Could not save cart session" }, { status: 500 });
  }
}
