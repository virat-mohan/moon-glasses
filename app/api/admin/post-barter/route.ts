import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { STORAGE_REF_PREFIX } from "@/lib/barter-post-detection";

type Supa = ReturnType<typeof getSupabaseServerClient>;

/** Story proof lives in a private bucket — hand the admin a one-hour signed link. */
async function signRef(supabase: Supa, ref: string | null) {
  if (!ref?.startsWith(STORAGE_REF_PREFIX)) return ref;
  const [bucket, ...rest] = ref.slice(STORAGE_REF_PREFIX.length).split("/");
  const { data } = await supabase.storage.from(bucket).createSignedUrl(rest.join("/"), 3600);
  return data?.signedUrl ?? null;
}

// Charged on the revenue a Pay With A Post code actually brings in (paid
// orders redeeming that code) — not on the barterer's own free order. Named
// a plain "platform service fee" rather than "licensing" or "gateway fee":
// this isn't an IP license and there's no payment gateway involved in a
// currency-free checkout, and a generic service-fee framing is the
// practically-safer label. Not legal advice — worth a quick check with
// whoever handles the business's compliance before this shows up on an
// invoice or a P&L line.
const PLATFORM_FEE_RATE = 0.01;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from"); // inclusive, ISO date (yyyy-mm-dd)
    const to = searchParams.get("to"); // inclusive, ISO date (yyyy-mm-dd)

    const supabase = getSupabaseServerClient();
    const { data: allOrders, error } = await supabase
      .from("orders")
      .select(
        "id, created_at, customer_name, customer_phone, barter_tier, barter_instagram_handle, barter_follower_count, barter_coupon_code, barter_required_orders, barter_post_url, barter_post_source, barter_post_detected_at, barter_qualified_at, total, delivered_at, barter_charge_deadline_at, barter_charge_link_sent_at, barter_charged_at"
      )
      .eq("is_post_barter", true)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const codes = (allOrders ?? []).map((o) => o.barter_coupon_code).filter(Boolean) as string[];
    let usageByCode: Record<string, number> = {};
    if (codes.length > 0) {
      const { data: coupons } = await supabase.from("coupon_codes").select("code, times_used").in("code", codes);
      usageByCode = Object.fromEntries((coupons ?? []).map((c) => [c.code, c.times_used ?? 0]));
    }

    const withProgress = await Promise.all(
      (allOrders ?? []).map(async (o) => ({
        ...o,
        barter_post_url: await signRef(supabase, o.barter_post_url),
        orders_so_far: o.barter_coupon_code ? (usageByCode[o.barter_coupon_code] ?? 0) : 0,
      }))
    );

    const { data: mentionRows } = await supabase
      .from("instagram_mentions")
      .select("id, kind, ig_username, permalink, media_ref, caption, matched_order_id, reposted_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    const mentions = await Promise.all(
      (mentionRows ?? []).map(async (m) => ({ ...m, media_ref: await signRef(supabase, m.media_ref) }))
    );

    // Everything below this line is the date-range-scoped picture — "how
    // many barterers signed up, and how much real revenue did their codes
    // drive" for whatever window the admin has selected.
    const inRange = withProgress.filter((o) => {
      if (from && o.created_at < from) return false;
      if (to && o.created_at > `${to}T23:59:59.999Z`) return false;
      return true;
    });

    const tierCounts = { sell_first: 0, gift_first: 0 };
    for (const o of inRange) {
      if (o.barter_tier === "sell_first") tierCounts.sell_first++;
      else if (o.barter_tier === "gift_first") tierCounts.gift_first++;
    }
    const qualifiedCount = inRange.filter((o) => o.barter_qualified_at).length;
    const postedCount = inRange.filter((o) => o.barter_post_url).length;
    const autoDetectedCount = inRange.filter((o) => o.barter_post_source).length;

    // Real, paid revenue driven by these barterers' codes — a friend
    // actually checking out with a Pay With A Post code, not the barterer's
    // own free order.
    let redeemedOrders: { id: string; total: number; created_at: string; coupon_code_used: string | null }[] = [];
    if (codes.length > 0) {
      let query = supabase
        .from("orders")
        .select("id, total, created_at, coupon_code_used")
        .in("coupon_code_used", codes)
        .eq("payment_status", "paid");
      if (from) query = query.gte("created_at", from);
      if (to) query = query.lte("created_at", `${to}T23:59:59.999Z`);
      const { data } = await query;
      redeemedOrders = data ?? [];
    }
    const revenueTotal = redeemedOrders.reduce((sum, o) => sum + (o.total ?? 0), 0);
    const feeAmount = Math.round(revenueTotal * PLATFORM_FEE_RATE);

    // Ranked by real impact — paid orders their code has driven, not just
    // whether they qualified — so an admin can see who's actually moving
    // product regardless of tier.
    const leaderboard = [...inRange]
      .filter((o) => o.barter_instagram_handle)
      .sort((a, b) => b.orders_so_far - a.orders_so_far)
      .slice(0, 20)
      .map((o) => ({
        handle: o.barter_instagram_handle,
        tier: o.barter_tier,
        followerCount: o.barter_follower_count,
        code: o.barter_coupon_code,
        ordersDriven: o.orders_so_far,
        qualified: !!o.barter_qualified_at,
      }));

    return NextResponse.json({
      orders: withProgress,
      mentions,
      stats: {
        postedCount,
        autoDetectedCount,
        from,
        to,
        totalBarterers: inRange.length,
        tierCounts,
        qualifiedCount,
        redeemedOrderCount: redeemedOrders.length,
        revenueTotal,
        feeRatePercent: PLATFORM_FEE_RATE * 100,
        feeAmount,
        leaderboard,
      },
    });
  } catch (err) {
    console.error("Failed to load post-barter orders", err);
    return NextResponse.json({ orders: [], stats: null }, { status: 500 });
  }
}
