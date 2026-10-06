import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { getGoogleReviewUrl } from "@/lib/reviews";
import { INSTAGRAM_URL, REVIEW_COPY as C } from "@/lib/review-core";

export const dynamic = "force-dynamic";
export const metadata = { title: "How was it?", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ReviewPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!UUID.test(orderId)) notFound();
  const supabase = getSupabaseServerClient();

  const [{ data: order }, { data: items }, { data: existingReviews }, googleUrl] = await Promise.all([
    supabase.from("orders").select("id, customer_name").eq("id", orderId).maybeSingle(),
    supabase.from("order_items").select("chapter_slug, chapter_name").eq("order_id", orderId),
    supabase.from("reviews").select("chapter_slug").eq("order_id", orderId),
    getGoogleReviewUrl(),
  ]);

  if (!order) notFound();

  const reviewedSlugs = new Set((existingReviews ?? []).map((r) => r.chapter_slug));
  const uniqueItems = [...new Map((items ?? []).map((i) => [i.chapter_slug, i])).values()].filter(
    (i) => !reviewedSlugs.has(i.chapter_slug)
  );

  return (
    <main className="mx-auto w-full max-w-[600px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
      <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
        Order #{order.id.slice(0, 8).toUpperCase()}
      </p>
      <h1 className="mt-2 font-display text-heading-xl text-ink">{C.pageTitle}</h1>
      <p className="mt-3 max-w-md text-base text-secondary-text">{C.pageIntro}</p>

      {uniqueItems.length === 0 ? (
        <div className="mt-8">
          <p className="text-base text-secondary-text">you have already reviewed everything from this order. thank you.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center border border-ink px-6 py-2 text-base text-ink hover:bg-ink hover:text-cream">{C.googleOption}</a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center border border-ink px-6 py-2 text-base text-ink hover:bg-ink hover:text-cream">{C.instagramOption}</a>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <ReviewForm
            orderId={order.id}
            items={uniqueItems.map((i) => ({ chapterSlug: i.chapter_slug, chapterName: i.chapter_name }))}
            customerName={order.customer_name}
            googleUrl={googleUrl}
            instagramUrl={INSTAGRAM_URL}
          />
        </div>
      )}
    </main>
  );
}
