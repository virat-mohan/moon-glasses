import { getSupabaseServerClient } from "@/lib/supabase";
import { getPwapRules } from "@/lib/pwap-rules";
import { parseInstagramHandle } from "@/lib/instagram";
import { barterCodeCandidates, codeBaseFromName, THEME_WORDS } from "@/lib/pwap-code";
import { canAddKit, barterAccessFor, type BarterAccess } from "@/lib/pwap-sales";
import { pickShareCardForNewKit } from "@/lib/share-card-pool";

export type PwapKit = {
  id: string;
  order_id: string;
  code: string;
  product_slug: string;
  image_path: string;
  sales_count: number;
  created_at: string;
};

export function kitImageUrl(imagePath: string): string {
  return `${process.env.SUPABASE_URL ?? ""}/storage/v1/object/public/ad-creatives/${imagePath}`;
}

/**
 * Mints a sensible, unique coupon code (NAME + theme word, then NAME + theme
 * + a number) and inserts it into coupon_codes: attribution-only, friend
 * discount per the rules. Never random letters.
 */
export async function mintBarterCouponCode(customerName: string, instagramHandle: string, friendDiscountRupees: number): Promise<string> {
  const supabase = getSupabaseServerClient();
  let base = codeBaseFromName(customerName, instagramHandle ? parseInstagramHandle(instagramHandle) : "");
  for (let round = 0; round < 2; round++) {
    const start = Math.floor(Math.random() * THEME_WORDS.length);
    const candidates = barterCodeCandidates(base, start);
    const { data: taken } = await supabase.from("coupon_codes").select("code").ilike("code", `${base.slice(0, 4)}%`).limit(1000);
    const takenSet = new Set((taken ?? []).map((r) => String(r.code).toUpperCase()));
    const { data: takenKits } = await supabase.from("pwap_post_kits").select("code").ilike("code", `${base.slice(0, 4)}%`).limit(1000);
    for (const k of takenKits ?? []) takenSet.add(String(k.code).toUpperCase());
    let tries = 0;
    for (const code of candidates) {
      if (takenSet.has(code)) continue;
      if (++tries > 25) break;
      const { error } = await supabase.from("coupon_codes").insert({ code, discount_type: "flat", discount_value: friendDiscountRupees });
      if (!error) return code;
    }
    base = "MOON"; // name had no usable code (e.g. blocked word): fall back once
  }
  throw new Error("Could not generate a unique barter coupon code");
}

type OrderForKits = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  barter_coupon_code: string | null;
  barter_instagram_handle?: string | null;
};

/** Kits for an order, first kit = the order's own code (made lazily for orders from before kits existed). */
export async function getOrderKits(order: OrderForKits): Promise<PwapKit[]> {
  const supabase = getSupabaseServerClient();
  const read = async () => {
    const { data } = await supabase.from("pwap_post_kits").select("*").eq("order_id", order.id).order("created_at", { ascending: true });
    return (data ?? []) as PwapKit[];
  };
  let kits = await read();
  if (!kits.some((k) => k.code === order.barter_coupon_code) && order.barter_coupon_code) {
    const { data: o } = await supabase.from("orders").select("barter_sales_count, created_at").eq("id", order.id).maybeSingle();
    // created_at is set just before the first card so it sorts first. Upsert, ignoring a
    // duplicate: two requests can arrive together (sign-in, then the page refresh) and
    // both would try to create the first post; one must not fail the other.
    await supabase.from("pwap_post_kits").upsert(
      {
        order_id: order.id,
        code: order.barter_coupon_code,
        product_slug: "legacy",
        image_path: `pwap-share/${order.id}.png`,
        sales_count: o?.barter_sales_count ?? 0,
        created_at: o?.created_at ?? new Date().toISOString(),
      },
      { onConflict: "code", ignoreDuplicates: true }
    );
    // The other request's row may still be committing: look again a few times.
    for (let attempt = 0; attempt < 4; attempt++) {
      kits = await read();
      if (kits.some((k) => k.code === order.barter_coupon_code)) break;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  return kits;
}

export type CreateKitResult = { ok: true; kit: PwapKit } | { ok: false; reason: "cap" | "failed" };

export async function createAnotherKit(order: OrderForKits): Promise<CreateKitResult> {
  const supabase = getSupabaseServerClient();
  const rules = await getPwapRules();
  const kits = await getOrderKits(order);
  if (!canAddKit(kits.length, rules.maxPostsPerOrder)) return { ok: false, reason: "cap" };

  const pick = await pickShareCardForNewKit({ email: order.customer_email, phone: order.customer_phone });
  if (!pick) return { ok: false, reason: "failed" };
  const code = await mintBarterCouponCode(order.customer_name, order.barter_instagram_handle ?? "", rules.friendDiscountRupees);
  const image_path = `pwap-share/${order.id}-k${kits.length + 1}-${code}.png`;
  const { data, error } = await supabase
    .from("pwap_post_kits")
    .insert({ order_id: order.id, code, product_slug: pick.slug, image_path })
    .select()
    .single();
  if (error || !data) {
    await supabase.from("coupon_codes").delete().eq("code", code);
    return { ok: false, reason: "failed" };
  }
  // A parallel tap may have slipped past the cap check: take the extra back.
  const after = await getOrderKits(order);
  if (after.length > rules.maxPostsPerOrder) {
    await supabase.from("pwap_post_kits").delete().eq("id", data.id);
    await supabase.from("coupon_codes").delete().eq("code", code);
    return { ok: false, reason: "cap" };
  }
  try {
    const { generateAndUploadPwapShareCard } = await import("@/lib/pwap-share-card");
    await generateAndUploadPwapShareCard(order.id, code, 0, { pick, path: image_path });
  } catch (err) {
    console.error("Kit card render failed (will retry on view)", order.id, err);
  }
  return { ok: true, kit: data as PwapKit };
}

/** Loads a PWAP order and decides what the current session may see. Used by the page and every kit endpoint. */
export async function resolveBarterAccess(orderId: string): Promise<
  | { order: (OrderForKits & { [k: string]: unknown }); access: BarterAccess }
  | null
> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const { getCurrentCustomer } = await import("@/lib/auth");
  const supabase = getSupabaseServerClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, customer_name, customer_email, customer_phone, barter_tier, barter_coupon_code, barter_required_orders, barter_post_url, barter_qualified_at, shiprocket_awb_code, barter_sales_count, barter_instagram_handle"
    )
    .eq("id", orderId)
    .eq("is_post_barter", true)
    .maybeSingle();
  if (!order) return null;
  const customer = order.customer_email ? await getCurrentCustomer() : null;
  return { order: order as never, access: barterAccessFor(order.customer_email, customer?.email) };
}
