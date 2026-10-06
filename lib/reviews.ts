import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { DEFAULT_GOOGLE_REVIEW_URL, shouldShowStoreStrip, summarize } from "@/lib/review-core";

export type Review = {
  id: string;
  order_id: string | null;
  chapter_slug: string | null;
  kind: string;
  customer_name: string;
  rating: number;
  review_text: string | null;
  approved: boolean;
  status: "pending" | "approved" | "hidden";
  verified: boolean;
  admin_reply: string | null;
  replied_at: string | null;
  source: string;
  contact: string | null;
  flagged_reason: string | null;
  created_at: string;
};

/** Where "share it on Google" points. Setting GOOGLE_REVIEW_URL, else the code default. */
export async function getGoogleReviewUrl(): Promise<string> {
  const v = (await getSetting("GOOGLE_REVIEW_URL"))?.trim();
  return v && /^https?:\/\//i.test(v) ? v : DEFAULT_GOOGLE_REVIEW_URL;
}

/** Approved reviews for one Chapter, newest first, what the product page actually shows. */
export async function getApprovedReviews(chapterSlug: string): Promise<Review[]> {
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("reviews")
      .select("*")
      .eq("chapter_slug", chapterSlug)
      .eq("kind", "product")
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    return (data ?? []) as Review[];
  } catch (err) {
    console.error("getApprovedReviews: Supabase fetch failed, returning no reviews", err);
    return [];
  }
}

/** Average rating + count across approved reviews of one Chapter. */
export async function getReviewSummary(chapterSlug: string) {
  return summarize(await getApprovedReviews(chapterSlug));
}

/** Store-wide rating for the homepage strip; null until there are enough real reviews. */
export async function getStoreRating(): Promise<{ average: number; count: number } | null> {
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase.from("reviews").select("rating").eq("status", "approved");
    const s = summarize(data ?? []);
    return s && shouldShowStoreStrip(s.count) ? s : null;
  } catch {
    return null;
  }
}
