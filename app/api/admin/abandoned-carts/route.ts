import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

/** Lists recent active/abandoned cart sessions for the admin to review and, if needed, retarget one manually. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    // Date range is on last_activity_at (Kolkata-local dates from the
    // <input type="date"> pickers, sent as YYYY-MM-DD) — "to" is inclusive
    // of the whole day, hence the +1 day/lt rather than a same-day lte.
    const from = params.get("from");
    const to = params.get("to");

    const supabase = getSupabaseServerClient();
    let query = supabase
      .from("cart_sessions")
      .select(
        "id, customer_name, customer_email, customer_phone, items, subtotal, status, retargeted_at, last_activity_at, created_at, abandon_reason, abandon_reason_note, abandon_reason_at, last_whatsapp_sent_at, last_email_sent_at"
      )
      .in("status", ["active", "abandoned"])
      .order("last_activity_at", { ascending: false });

    if (from) query = query.gte("last_activity_at", `${from}T00:00:00+05:30`);
    if (to) {
      const toDate = new Date(`${to}T00:00:00+05:30`);
      toDate.setDate(toDate.getDate() + 1);
      query = query.lt("last_activity_at", toDate.toISOString());
    }
    // A date range means the admin is deliberately looking beyond "recent" —
    // the default (no range) view stays capped at 50 for a fast page load.
    if (!from && !to) query = query.limit(50);

    const { data, error } = await query;
    if (error) throw error;

    // Reason counts cover every session that ever answered, regardless of
    // status (a cart can convert after answering, or fall outside the
    // 50-row window above) — a separate, unlimited query keeps that count
    // accurate independent of the list pagination.
    const { data: reasonRows, error: reasonError } = await supabase
      .from("cart_sessions")
      .select("abandon_reason")
      .not("abandon_reason", "is", null);
    if (reasonError) throw reasonError;

    const reasonCounts: Record<string, number> = {};
    for (const row of reasonRows ?? []) {
      const reason = row.abandon_reason as string;
      reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
    }

    return NextResponse.json({ sessions: data ?? [], reasonCounts });
  } catch (err) {
    console.error("Failed to list cart sessions", err);
    return NextResponse.json({ sessions: [], reasonCounts: {} }, { status: 500 });
  }
}
