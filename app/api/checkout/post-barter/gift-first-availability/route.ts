import { NextResponse } from "next/server";
import { getPostBarterConfig, giftFirstCountToday, isPostBarterEnabled } from "@/lib/post-barter";

/**
 * Public, no-auth read of today's Gift First availability — powers the
 * on-site urgency indicator ("Only 3 Gift First spots left today"). Never
 * exposes anything sensitive, just a count against the admin-set daily cap
 * (POST_BARTER_GIFT_FIRST_DAILY_CAP in /admin/settings).
 */
export async function GET() {
  if (!(await isPostBarterEnabled())) {
    return NextResponse.json({ error: "Pay With A Post isn't available right now." }, { status: 403 });
  }
  const [{ giftFirstDailyCap }, usedToday] = await Promise.all([getPostBarterConfig(), giftFirstCountToday()]);
  const remaining = Math.max(0, giftFirstDailyCap - usedToday);
  return NextResponse.json({ cap: giftFirstDailyCap, remaining });
}
