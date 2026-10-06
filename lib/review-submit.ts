import { getSupabaseServerClient } from "@/lib/supabase";
import { sendCustomerIssueAlert } from "@/lib/email";
import {
  MAX_CONTACT_CHARS, MAX_NAME_CHARS, MAX_REVIEW_CHARS, cleanText, itemKey, moderationDecision,
  shouldAlertLowRating, splitNewAndDuplicate,
} from "@/lib/review-core";

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

type Saved = { id: string; rating: number; text: string; slug: string | null };

/** Low rating: one internal email so someone can make it right. Never touches the review's visibility. */
async function alertLow(args: { reviewId: string; rating: number; text: string; pair: string | null; orderId: string | null; isTest: boolean }) {
  if (!shouldAlertLowRating(args.rating, args.isTest)) return;
  const supabase = getSupabaseServerClient();
  const { data: claimed } = await supabase
    .from("reviews").update({ alerted_at: new Date().toISOString() }).eq("id", args.reviewId).is("alerted_at", null).select("id");
  if (!claimed || claimed.length === 0) return;
  const short = args.orderId ? `#${args.orderId.slice(0, 8).toUpperCase()}` : "store feedback";
  await sendCustomerIssueAlert(
    `${args.rating}-star review, ${short}`,
    [
      `${args.rating}-star review ${args.orderId ? `on order ${short}` : "(store feedback, no order)"}`,
      ...(args.pair ? [`Pair: ${args.pair}`] : []),
      `Said: ${args.text || "(no text)"}`,
      "It stays visible per its normal moderation. Please reach out and make it right.",
    ],
    args.orderId ?? undefined
  ).catch(() => {});
}

export async function submitOrderReviews(input: {
  orderId: string;
  name: string;
  entries: { chapterSlug: string; rating: number; text: string }[];
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const supabase = getSupabaseServerClient();
  const { data: order } = await supabase.from("orders").select("id, customer_name, is_test").eq("id", input.orderId).maybeSingle();
  if (!order) return { status: 404, body: { error: "We couldn't find that order" } };
  const { data: items } = await supabase.from("order_items").select("chapter_slug, chapter_name").eq("order_id", order.id);
  const inOrder = new Map((items ?? []).map((i) => [i.chapter_slug, i.chapter_name as string]));
  if (input.entries.some((e) => !inOrder.has(e.chapterSlug))) return { status: 400, body: { error: "That item isn't part of this order" } };

  const { data: existing } = await supabase.from("reviews").select("order_id, chapter_slug").eq("order_id", order.id);
  const existingKeys = new Set((existing ?? []).map((r) => itemKey(r.order_id, r.chapter_slug)));
  const { fresh, duplicates } = splitNewAndDuplicate(order.id, input.entries.map((e) => e.chapterSlug), existingKeys);
  if (fresh.length === 0) return { status: 409, body: { error: "This pair already has a review, thank you", duplicates } };

  const name = cleanText(input.name, MAX_NAME_CHARS) || cleanText(order.customer_name, MAX_NAME_CHARS) || "A customer";
  const saved: Saved[] = [];
  for (const e of input.entries.filter((x) => fresh.includes(x.chapterSlug))) {
    const text = cleanText(e.text, MAX_REVIEW_CHARS);
    const d = moderationDecision({ verified: true, text, name });
    const { data, error } = await supabase
      .from("reviews")
      .insert({
        kind: "product", order_id: order.id, chapter_slug: e.chapterSlug, customer_name: name, rating: e.rating,
        review_text: text || null, verified: true, status: d.status, approved: d.status === "approved",
        flagged_reason: d.flagged_reason, source: "order_page",
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") continue; // lost a race with a double-tap: already saved
      throw error;
    }
    saved.push({ id: data.id, rating: e.rating, text, slug: e.chapterSlug });
    await alertLow({ reviewId: data.id, rating: e.rating, text, pair: inOrder.get(e.chapterSlug) ?? null, orderId: order.id, isTest: order.is_test === true });
  }
  return { status: 200, body: { ok: true, saved: saved.length, slugs: saved.map((s) => s.slug) } };
}

export async function submitStoreFeedback(input: { name: string; rating: number; text: string; contact: string }) {
  const supabase = getSupabaseServerClient();
  const name = cleanText(input.name, MAX_NAME_CHARS) || "A customer";
  const text = cleanText(input.text, MAX_REVIEW_CHARS);
  const contact = cleanText(input.contact, MAX_CONTACT_CHARS) || null;
  const d = moderationDecision({ verified: false, text, name });
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      kind: "store", order_id: null, chapter_slug: null, customer_name: name, rating: input.rating, review_text: text || null,
      verified: false, status: "pending", approved: false, flagged_reason: d.flagged_reason, source: "feedback_page", contact,
    })
    .select("id")
    .single();
  if (error) throw error;
  await alertLow({ reviewId: data.id, rating: input.rating, text: contact ? `${text} (contact: ${contact})` : text, pair: null, orderId: null, isTest: false });
}
