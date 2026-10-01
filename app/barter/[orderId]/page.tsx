import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getBrandProfile } from "@/lib/brand";
import { BarterPostUrlForm } from "@/components/checkout/BarterPostUrlForm";
import { SharePost } from "@/components/checkout/SharePost";
import { generateAndUploadPwapShareCard } from "@/lib/pwap-share-card";
import { PayWithAPostMark } from "@/components/ui/PayWithAPostMark";
import { OpenOnPhoneQr } from "@/components/checkout/OpenOnPhoneQr";

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

  // The post image is rendered on the server when the order is placed; reuse
  // that file so the page shows it instantly (render it once if missing).
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  let cardUrl = `${supabaseUrl}/storage/v1/object/public/ad-creatives/pwap-share/${order.id}.png`;
  if (order.barter_coupon_code) {
    const head = await fetch(cardUrl, { method: "HEAD", cache: "no-store" }).catch(() => null);
    if (!head?.ok) cardUrl = (await generateAndUploadPwapShareCard(order.id, order.barter_coupon_code).catch(() => null)) ?? "";
  }
  const siteDomain = brand.siteUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  const handle = brand.instagramHandle.startsWith("@") ? brand.instagramHandle : `@${brand.instagramHandle}`;
  const caption = `Shop ${siteDomain} and use my code ${order.barter_coupon_code} at checkout 🌙 ${handle}\n\nPowered by Pay With A Post™`;
  const shipped = isGiftFirst || !!order.barter_qualified_at;

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pt-6 pb-20 md:pt-12">
      <p className="text-caption uppercase tracking-[0.15em]">
        <PayWithAPostMark />
      </p>
      <h1 className="mt-1 font-display text-heading-l uppercase text-ink">Your post is ready</h1>

      {cardUrl && order.barter_coupon_code ? (
        <div className="mt-5">
          <SharePost cardUrl={cardUrl} caption={caption} />
          <OpenOnPhoneQr />
        </div>
      ) : (
        <p className="mt-5 text-body-s text-secondary-text">Preparing your post… refresh in a moment.</p>
      )}

      <div className="mt-6 border border-divider p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-body-s font-bold text-ink">
            {shipped ? `${towardNext} / ${required} to your next free pair` : `${sales} / ${required} sales`}
          </p>
          <code className="text-caption tracking-[0.1em] text-tan-gold">{order.barter_coupon_code}</code>
        </div>
        <div className="mt-2 h-2 w-full bg-surface-alt">
          <div className="h-2 bg-[var(--moon-gold)]" style={{ width: `${Math.min(100, (towardNext / required) * 100)}%` }} />
        </div>
        <p className="mt-2 text-caption text-secondary-text">
          {isGiftFirst
            ? `Your pair is on its way${order.shiprocket_awb_code ? ` (AWB ${order.shiprocket_awb_code})` : ""}. Post once it arrives.`
            : order.barter_qualified_at
              ? "Your pair has shipped, free."
              : `${required} sales on your code = your pair ships free.`}{" "}
          Every {required} more = another free pair.
        </p>
      </div>

      {rewards.length > 0 && (
        <div className="mt-4 border-2 border-[var(--moon-gold)] p-4">
          <p className="text-body-s font-bold text-ink">Free pairs earned</p>
          <ul className="mt-2 space-y-1.5">
            {rewards.map((r) => (
              <li key={r.code} className="flex items-center justify-between gap-2 text-caption">
                <code className="tracking-[0.08em] text-ink">{r.code}</code>
                <span className="text-secondary-text">{r.used ? "Used" : "Use at checkout"}</span>
              </li>
            ))}
          </ul>
          {rewards.some((r) => !r.used) && (
            <Link href="/#shop" className="mt-3 block w-full bg-[var(--moon-gold)] py-3 text-center text-caption font-bold uppercase tracking-[0.08em] text-black">
              Pick your free pair
            </Link>
          )}
        </div>
      )}

      <details className="mt-6 border-t border-divider pt-4 text-caption text-secondary-text">
        <summary className="cursor-pointer font-bold uppercase tracking-[0.08em] text-ink">How it works</summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5">
          <li>Post the image on Instagram (feed or story) and paste the caption.</li>
          <li>
            Feed post: tap Tag people → Invite collaborator →{" "}
            <a href={instagramProfileUrl} target="_blank" rel="noreferrer" className="underline">
              {handle}
            </a>
            .
          </li>
          <li>Friends buy with your code at full price. Your own orders don&apos;t count.</li>
          <li>Add #gifted where required by Instagram&apos;s disclosure rules.</li>
        </ol>
        <p className="mt-4 font-bold uppercase tracking-[0.08em] text-ink">Posted? Drop the link</p>
        <BarterPostUrlForm orderId={order.id} initialUrl={order.barter_post_url} />
      </details>
    </main>
  );
}
