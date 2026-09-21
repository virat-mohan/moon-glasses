import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getBrandProfile } from "@/lib/brand";
import { BarterPostUrlForm } from "@/components/checkout/BarterPostUrlForm";
import { ShareToInstagramButton } from "@/components/checkout/ShareToInstagramButton";

export const dynamic = "force-dynamic";

export default async function BarterOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supabase = getSupabaseServerClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, customer_name, barter_tier, barter_coupon_code, barter_required_orders, barter_post_url, barter_qualified_at, shiprocket_awb_code"
    )
    .eq("id", orderId)
    .eq("is_post_barter", true)
    .maybeSingle();
  if (!order) notFound();

  const brand = await getBrandProfile();
  const instagramProfileUrl = `https://instagram.com/${brand.instagramHandle.replace(/^@/, "")}`;
  const isGiftFirst = order.barter_tier === "gift_first";

  let ordersSoFar = 0;
  if (order.barter_coupon_code) {
    const { data: coupon } = await supabase
      .from("coupon_codes")
      .select("times_used")
      .eq("code", order.barter_coupon_code)
      .maybeSingle();
    ordersSoFar = coupon?.times_used ?? 0;
  }

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
      {!isGiftFirst && (
        <>
          <p className="mt-4 text-body-s text-ink">
            {ordersSoFar} / {order.barter_required_orders} orders so far
          </p>
          <div className="mt-2 h-2 w-full max-w-[280px] bg-surface-alt">
            <div
              className="h-2 bg-tan-gold"
              style={{ width: `${Math.min(100, (ordersSoFar / order.barter_required_orders) * 100)}%` }}
            />
          </div>
        </>
      )}
      <div className="mt-5">
        <ShareToInstagramButton
          couponCode={order.barter_coupon_code}
          brandName={brand.brandName}
          instagramHandle={brand.instagramHandle}
          siteUrl={brand.siteUrl}
          requiredOrders={order.barter_required_orders}
        />
      </div>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-[600px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
      <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">Pay With A Post</p>
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
            <li>Post it on Instagram and add {tagLink} as a collaborator (or tag us if collaborator invites aren&apos;t available to you).</li>
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
              {order.barter_required_orders} buyers. Add {tagLink} as a collaborator (or tag us if
              collaborator invites aren&apos;t available to you).
            </li>
            <li>
              Share your code below with your followers — anyone who checks out with it gets a
              discount, and it counts toward your goal.
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
