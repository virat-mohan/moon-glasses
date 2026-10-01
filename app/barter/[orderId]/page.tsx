import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getBrandProfile } from "@/lib/brand";
import { BarterPostUrlForm } from "@/components/checkout/BarterPostUrlForm";
import { ShareToInstagramButton } from "@/components/checkout/ShareToInstagramButton";
import { PayWithAPostMark } from "@/components/ui/PayWithAPostMark";
import { pickShareCardForOrder } from "@/lib/share-card-pool";

export const dynamic = "force-dynamic";

export default async function BarterOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supabase = getSupabaseServerClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, customer_name, barter_tier, barter_coupon_code, barter_required_orders, barter_post_url, barter_qualified_at, shiprocket_awb_code, barter_sales_count"
    )
    .eq("id", orderId)
    .eq("is_post_barter", true)
    .maybeSingle();
  if (!order) notFound();

  const brand = await getBrandProfile();
  const instagramProfileUrl = `https://instagram.com/${brand.instagramHandle.replace(/^@/, "")}`;
  const isGiftFirst = order.barter_tier === "gift_first";

  // A different model/product per order (seeded on the order id, so the
  // same order always shows the same pick) — the point being that a stream
  // of these posts, once tagged/collaborator-added, reads as a varied
  // lookbook rather than the same single photo shared by every barterer.
  const shareProduct = await pickShareCardForOrder(order.id);

  // Real, paid, non-self sales on the code (kept up to date as orders land).
  const required = Math.max(1, order.barter_required_orders ?? 3);
  const sales = order.barter_sales_count ?? 0;
  const firstPairDone = isGiftFirst || !!order.barter_qualified_at;
  // After the first pair, every further block of `required` sales = another free pair.
  const towardNext = firstPairDone ? sales % required : sales;
  const { data: rewardRows } = await supabase
    .from("pwap_rewards")
    .select("coupon_code, created_at")
    .eq("barter_order_id", order.id)
    .order("created_at", { ascending: true });
  const rewardCodes = (rewardRows ?? []).map((r) => r.coupon_code as string);
  const { data: rewardCoupons } = rewardCodes.length
    ? await supabase.from("coupon_codes").select("code, times_used, expires_at").in("code", rewardCodes)
    : { data: [] as { code: string; times_used: number; expires_at: string | null }[] };
  const rewards = rewardCodes.map((code) => {
    const c = (rewardCoupons ?? []).find((x) => x.code === code);
    return { code, used: (c?.times_used ?? 0) > 0, expires: c?.expires_at ?? null };
  });

  const tagLink = (
    <a href={instagramProfileUrl} target="_blank" rel="noreferrer" className="underline">
      {brand.instagramHandle}
    </a>
  );

  const codeBlock = order.barter_coupon_code && (
    <div className="mt-8 border border-divider p-6">
      <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">Your Code</p>
      <code className="mt-3 inline-block border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s tracking-[0.1em] text-ink">
        {order.barter_coupon_code}
      </code>
      <p className="mt-4 text-body-s text-ink">
        {firstPairDone ? (
          <>
            {sales} {sales === 1 ? "sale" : "sales"} on your code · {towardNext} / {required} towards your next free pair
          </>
        ) : (
          <>
            {sales} / {required} orders so far, then your pair ships free
          </>
        )}
      </p>
      <div className="mt-2 h-2 w-full max-w-[280px] bg-surface-alt">
        <div className="h-2 bg-tan-gold" style={{ width: `${Math.min(100, (towardNext / required) * 100)}%` }} />
      </div>
      <p className="mt-2 text-caption text-secondary-text">
        It doesn&apos;t stop at {required}: every {required} more sales on your code earns you another pair, free. Your
        code never expires.
      </p>
      {rewards.length > 0 && (
        <div className="mt-5 border-t border-divider pt-4">
          <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">Free pairs you&apos;ve earned</p>
          <ul className="mt-2 space-y-1.5">
            {rewards.map((r) => (
              <li key={r.code} className="flex flex-wrap items-center gap-2 text-body-s text-ink">
                <code className="border border-ink/30 px-2 py-0.5 tracking-[0.08em]">{r.code}</code>
                <span className="text-caption text-secondary-text">
                  {r.used
                    ? "Used"
                    : `Any style, free · use at checkout${r.expires ? ` by ${new Date(r.expires).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}`}
                </span>
              </li>
            ))}
          </ul>
          {rewards.some((r) => !r.used) && (
            <Link href="/#shop" className="mt-3 inline-block border border-ink px-4 py-2 text-caption font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream">
              Pick your free pair
            </Link>
          )}
        </div>
      )}
      <div className="mt-5">
        {shareProduct ? (
          <ShareToInstagramButton
            couponCode={order.barter_coupon_code}
            instagramHandle={brand.instagramHandle}
            siteUrl={brand.siteUrl}
            requiredOrders={order.barter_required_orders}
            heroImageUrl={shareProduct.imageUrl}
            productName={shareProduct.productName}
          />
        ) : (
          <p className="text-caption text-secondary-text">
            Share image isn&apos;t ready yet — check back in a moment.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-[600px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
      <p className="text-caption uppercase tracking-[0.15em]">
        <PayWithAPostMark linked />
      </p>
      <h1 className="mt-2 font-display text-heading-xl uppercase text-ink">Hi, {order.customer_name}</h1>

      {isGiftFirst ? (
        <>
          <div className="mt-8 border border-divider p-6">
            <p className="text-body-s text-ink">
              Your order is already on its way{order.shiprocket_awb_code ? ` (AWB ${order.shiprocket_awb_code})` : ""} —
              no need to wait for anything.
            </p>
          </div>
          <ol className="mt-8 list-decimal space-y-3 pl-5 text-body-s text-ink">
            <li>Once it arrives, wear it and take a photo or Reel.</li>
            <li>Post it on Instagram — full steps (mobile, desktop, and adding {tagLink} as a collaborator) are below.</li>
          </ol>
          <p className="mt-4 text-caption text-secondary-text">
            Please disclose the gifted relationship where required (e.g. &ldquo;#gifted&rdquo; or a
            paid-partnership label) per Instagram&apos;s ad disclosure guidelines.
          </p>
          {codeBlock}
          <div className="mt-8">
            <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">
              Posted already? Drop the link here
            </p>
            <BarterPostUrlForm orderId={order.id} initialUrl={order.barter_post_url} />
          </div>
        </>
      ) : order.barter_qualified_at ? (
        <div className="mt-8 border-2 border-ink bg-surface-alt p-6">
          <p className="font-sans text-body font-bold uppercase text-ink">Your Good Vibes Came Through</p>
          <p className="mt-2 text-body-s text-ink">
            Your network showed up for you — your order shipped
            {order.shiprocket_awb_code ? ` (AWB ${order.shiprocket_awb_code})` : ""}, completely free.
          </p>
          <Link
            href={brand.siteUrl}
            className="mt-4 inline-block border border-ink bg-ink px-6 py-2.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-cream hover:bg-cream hover:text-ink"
          >
            Spread More Good Vibes — Shop Another Pair
          </Link>
        </div>
      ) : (
        <>
          <ol className="mt-8 list-decimal space-y-3 pl-5 text-body-s text-ink">
            <li>
              Share it your way — feed post or Story, whichever you&apos;re confident can get you{" "}
              {order.barter_required_orders} buyers. Full steps (mobile, desktop, and adding {tagLink} as a
              collaborator) are below.
            </li>
            <li>
              Share your code below with your followers — anyone who checks out with it counts
              toward your goal (full price, no discount).
            </li>
            <li>
              Once <strong>{order.barter_required_orders}</strong> people have checked out with your
              code, we ship your order automatically — no need to ask.
            </li>
          </ol>
          <p className="mt-4 text-caption text-secondary-text">
            Please disclose the gifted relationship where required (e.g. &ldquo;#gifted&rdquo; or a
            paid-partnership label) per Instagram&apos;s ad disclosure guidelines.
          </p>

          {codeBlock}

          <div className="mt-8">
            <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">
              Posted already? Drop the link here
            </p>
            <BarterPostUrlForm orderId={order.id} initialUrl={order.barter_post_url} />
          </div>
        </>
      )}
    </main>
  );
}
