import { getSupabaseServerClient } from "@/lib/supabase";
import { getBrandProfile } from "@/lib/brand";
import { generateAndUploadPwapShareCard } from "@/lib/pwap-share-card";
import { sendWhatsAppSessionImage } from "@/lib/msg91";

/**
 * The "Get my post on WhatsApp" path: the shopper messages us first (which
 * opens WhatsApp's 24-hour window, so Meta's marketing limits don't apply)
 * and we reply with their share image, code and posting steps. Matches the
 * order by a code in the message, else by the sender's phone.
 */
export function wantsPwapPost(text: string | null | undefined) {
  return !!text && /pay with a post|post image|my post|pwap/i.test(text);
}

export async function replyWithPwapPost(phone: string, text: string) {
  const supabase = getSupabaseServerClient();
  const codeMatch = text.toUpperCase().match(/CODE[:\s·-]*([A-Z0-9]{4,30})/);
  const digits = phone.replace(/\D/g, "").slice(-10);

  let query = supabase
    .from("orders")
    .select("id, customer_name, barter_coupon_code, barter_required_orders, barter_tier")
    .eq("is_post_barter", true)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1);
  query = codeMatch ? query.eq("barter_coupon_code", codeMatch[1]) : query.ilike("customer_phone", `%${digits}`);
  const { data: rows } = await query;
  const order = rows?.[0];
  if (!order?.barter_coupon_code) return false;

  const brand = await getBrandProfile();
  const site = brand.siteUrl.replace(/\/$/, "").replace(/^https:\/\/(?!www\.)/, "https://www.");
  const handle = brand.instagramHandle.startsWith("@") ? brand.instagramHandle : `@${brand.instagramHandle}`;
  const cardUrl = await generateAndUploadPwapShareCard(order.id, order.barter_coupon_code);
  if (!cardUrl) return false;

  const first = (order.customer_name ?? "").split(" ")[0] || "there";
  const target =
    order.barter_tier === "gift_first"
      ? "Your pair is on its way. Post once it arrives."
      : `Your pair ships free once ${order.barter_required_orders} people buy with your code.`;
  const caption =
    `Hi ${first}! Here's your Pay With A Post image.\n\n` +
    `1. Save this image and post it on Instagram (feed or story).\n` +
    `2. Tag ${handle} and add your code ${order.barter_coupon_code} in the caption.\n` +
    `3. ${target} Every 3 more sales after that earns you another free pair.\n\n` +
    `Track your progress: ${site}/barter/${order.id}`;
  const result = await sendWhatsAppSessionImage(phone, cardUrl, caption);
  return result.sent;
}
