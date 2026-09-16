import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { retargetOneSession } from "@/lib/abandoned-cart";

/** Manually sends the abandoned-cart nudge for exactly one session — e.g. to test the flow against your own cart without sweeping every stale session. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const supabase = getSupabaseServerClient();
    const { data: session } = await supabase
      .from("cart_sessions")
      .select("id, customer_name, customer_phone, customer_email, items, retargeted_at")
      .eq("id", id)
      .maybeSingle();
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const { whatsappSent, emailSent } = await retargetOneSession(session);
    if (!whatsappSent && !emailSent) {
      return NextResponse.json({ error: "Neither WhatsApp nor email send succeeded — check settings/logs" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, whatsappSent, emailSent });
  } catch (err) {
    console.error("Failed to send abandoned-cart nudge for session", id, err);
    return NextResponse.json({ error: "Could not send" }, { status: 500 });
  }
}
