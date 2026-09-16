import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase";
import { ReviewForm } from "@/components/reviews/ReviewForm";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supabase = getSupabaseServerClient();

  const [{ data: order }, { data: items }, { data: existingReviews }] = await Promise.all([
    supabase.from("orders").select("id, customer_name").eq("id", orderId).maybeSingle(),
    supabase.from("order_items").select("chapter_slug, chapter_name").eq("order_id", orderId),
    supabase.from("reviews").select("chapter_slug").eq("order_id", orderId),
  ]);

  if (!order) notFound();

  const reviewedSlugs = new Set((existingReviews ?? []).map((r) => r.chapter_slug));
  const uniqueItems = [
    ...new Map((items ?? []).map((i) => [i.chapter_slug, i])).values(),
  ].filter((i) => !reviewedSlugs.has(i.chapter_slug));

  return (
    <main className="mx-auto w-full max-w-[600px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
      <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
        Order #{order.id.slice(0, 8).toUpperCase()}
      </p>
      <h1 className="mt-2 font-display text-heading-xl uppercase text-ink">How Was It?</h1>
      <p className="mt-3 max-w-md text-body-s text-secondary-text">
        A quick rating helps other travellers pick the right Chapter.
      </p>

      {uniqueItems.length === 0 ? (
        <p className="mt-8 text-body-s text-secondary-text">
          You&apos;ve already reviewed everything from this order — thank you.
        </p>
      ) : (
        <div className="mt-8">
          <ReviewForm
            orderId={order.id}
            items={uniqueItems.map((i) => ({ chapterSlug: i.chapter_slug, chapterName: i.chapter_name }))}
            customerName={order.customer_name}
          />
        </div>
      )}
    </main>
  );
}
