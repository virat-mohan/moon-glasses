import Link from "next/link";
import { WhatsAppHelp } from "@/components/help/WhatsAppHelp";
import { getSetting } from "@/lib/settings";
import { shortOrderId } from "@/lib/whatsapp-help";
import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getBrandProfile } from "@/lib/brand";
import { BarterPostUrlForm } from "@/components/checkout/BarterPostUrlForm";
import { getPwapRules } from "@/lib/pwap-rules";
import { SharePost } from "@/components/checkout/SharePost";
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
  // After the first pair, every `salesPerFreeCode` more sales = a free code.
  const { salesPerFreeCode } = await getPwapRules();
  const shipAt = isGiftFirst ? 0 : required;
  const towardNext = firstPairDone ? (sales - shipAt) % salesPerFreeCode : sales;
  const barTarget = firstPairDone ? salesPerFreeCode : required;
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

  // The post image is made right after the order is placed. Link it straight
  // away (no storage check before render); if it isn't ready yet, SharePost
  // shows "making your post" and asks /api/barter/[id]/card to finish it.
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const cardUrl = `${supabaseUrl}/storage/v1/object/public/ad-creatives/pwap-share/${order.id}.png`;
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
          <SharePost orderId={order.id} cardUrl={cardUrl} caption={caption} />
          <OpenOnPhoneQr />
        </div>
      ) : (
        <p className="mt-5 text-body-s text-secondary-text">Preparing your post… refresh in a moment.</p>
      )}

      <div className="mt-6 border border-divider p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-body-s font-bold text-ink">
            {shipped ? `${towardNext} / ${barTarget} to your next free pair` : `${sales} / ${required} sales`}
          </p>
          <code className="text-caption tracking-[0.1em] text-tan-gold">{order.barter_coupon_code}</code>
        </div>
        <div className="mt-2 h-2 w-full bg-surface-alt">
          <div className="h-2 bg-[var(--moon-gold)]" style={{ width: `${Math.min(100, (towardNext / barTarget) * 100)}%` }} />
        </div>
        <p className="mt-2 text-caption text-secondary-text">
          {isGiftFirst
            ? `Your pair is on its way${order.shiprocket_awb_code ? ` (AWB ${order.shiprocket_awb_code})` : ""}. Post once it arrives.`
            : order.barter_qualified_at
              ? "Your pair has shipped, free."
              : `${required} sales on your code = your pair ships free.`}{" "}
          Every {salesPerFreeCode} more = another free pair.
        </p>
      </div>

      {rewards.length > 0 && (
        <div className="mt-4 border-2 border-[var(--moon-gold)] p-4">
          <p className="text-body-s font-bold text-ink">Free pairs earned</p>
          <ul className="mt-2 space-y-1.5">
            {rewards.map((r, i) => (
              // The code itself is only sent on WhatsApp/email: this page can be
              // opened by anyone the link reaches, and the code is single-use.
              <li key={r.code} className="flex items-center justify-between gap-2 text-caption">
                <span className="text-ink">Free pair {i + 1}</span>
                <span className="text-secondary-text">{r.used ? "Used" : "Code sent on WhatsApp & email"}</span>
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
        <Link href="/pay-with-a-post/terms" className="mt-3 inline-block underline underline-offset-4">
          Full terms
        </Link>
        {/* Sell-first pays out on sales, so the post link is only needed when we ship first. */}
        {isGiftFirst && (
          <>
            <p className="mt-4 font-bold uppercase tracking-[0.08em] text-ink">Posted? Drop the link</p>
            <BarterPostUrlForm orderId={order.id} initialUrl={order.barter_post_url} />
          </>
        )}
      </details>
      <p className="mt-6">
        <WhatsAppHelp
          label="code not working? whatsapp us"
          topic="pay with a post code"
          lines={[...(order.barter_coupon_code ? [`code: ${order.barter_coupon_code}`] : []), `order ${shortOrderId(order.id)}`]}
          number={await getSetting("SUPPORT_WHATSAPP")}
        />
      </p>
    </main>
  );
}
