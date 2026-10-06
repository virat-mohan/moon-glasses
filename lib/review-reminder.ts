import { getSupabaseServerClient } from "@/lib/supabase";
import { sendReviewReminderEmail } from "@/lib/email";
import { REVIEW_REMINDER_AFTER_DAYS, REVIEW_REMINDER_MAX_AGE_DAYS, reminderEligible } from "@/lib/review-core";

/** One gentle reminder per order, email only. Claims the order first so a retry can never send twice. */
export async function runReviewReminders(): Promise<{ checked: number; sent: number }> {
  const supabase = getSupabaseServerClient();
  const now = Date.now();
  const from = new Date(now - REVIEW_REMINDER_MAX_AGE_DAYS * 86_400_000).toISOString();
  const to = new Date(now - REVIEW_REMINDER_AFTER_DAYS * 86_400_000).toISOString();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, customer_name, customer_email, is_test, delivered_at, review_requested_at, review_reminded_at")
    .not("delivered_at", "is", null)
    .not("review_requested_at", "is", null)
    .is("review_reminded_at", null)
    .gte("delivered_at", from)
    .lte("delivered_at", to)
    .limit(100);

  let sent = 0;
  for (const o of orders ?? []) {
    const [{ count: reviews }, { count: returns }] = await Promise.all([
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("order_id", o.id),
      supabase.from("return_requests").select("id", { count: "exact", head: true }).eq("order_id", o.id),
    ]);
    if (!reminderEligible(o, { hasReview: (reviews ?? 0) > 0, hasReturn: (returns ?? 0) > 0 }, now)) continue;
    const { data: claimed } = await supabase
      .from("orders")
      .update({ review_reminded_at: new Date().toISOString() })
      .eq("id", o.id)
      .is("review_reminded_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) continue;
    const { data: items } = await supabase.from("order_items").select("chapter_name").eq("order_id", o.id);
    const names = [...new Set((items ?? []).map((i) => i.chapter_name))];
    if (names.length === 0 || !o.customer_email) continue;
    if (await sendReviewReminderEmail(o.customer_email, o.customer_name, o.id, names)) sent++;
  }
  return { checked: orders?.length ?? 0, sent };
}
