import { getSupabaseServerClient } from "@/lib/supabase";

export type Review = {
  id: string;
  order_id: string;
  chapter_slug: string;
  customer_name: string;
  rating: number;
  review_text: string | null;
  approved: boolean;
  created_at: string;
};

/** Approved reviews for one Chapter, newest first — what the product page actually shows. */
export async function getApprovedReviews(chapterSlug: string): Promise<Review[]> {
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("reviews")
      .select("*")
      .eq("chapter_slug", chapterSlug)
      .eq("approved", true)
      .order("created_at", { ascending: false });
    return data ?? [];
  } catch (err) {
    console.error("getApprovedReviews: Supabase fetch failed, returning no reviews", err);
    return [];
  }
}

/** Average rating + count across approved reviews — feeds the Product JSON-LD aggregateRating. */
export async function getReviewSummary(chapterSlug: string) {
  const reviews = await getApprovedReviews(chapterSlug);
  if (reviews.length === 0) return null;
  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  return { average: Math.round(average * 10) / 10, count: reviews.length };
}
