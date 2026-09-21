import { getSupabaseServerClient } from "@/lib/supabase";

export type CreatorStatus =
  | "applied"
  | "approved"
  | "rejected"
  | "agreement_sent"
  | "agreed"
  | "product_shipped"
  | "content_received"
  | "completed";

export const CREATOR_STATUSES: CreatorStatus[] = [
  "applied",
  "approved",
  "rejected",
  "agreement_sent",
  "agreed",
  "product_shipped",
  "content_received",
  "completed",
];

// Which statuses a status can move to from admin/creator actions — not a
// hard DB constraint, just the set of transitions the UI offers, so the
// lifecycle stays legible without needing a real state-machine library for
// what is, today, a single linear path with one branch (approved/rejected).
// "agreed" is deliberately not admin-settable here — it only ever flips
// automatically when the creator actually signs at /creator/agreement/[id]
// (see app/api/creators/[id]/sign/route.ts). "agreement_sent" is likewise
// not a manual step: approving IS sending the agreement (see the PATCH
// handler in app/api/admin/creators/route.ts), so that status value exists
// for clarity in a status label but never appears as an admin action here.
export const CREATOR_STATUS_TRANSITIONS: Record<CreatorStatus, CreatorStatus[]> = {
  applied: ["approved", "rejected"],
  approved: ["rejected"],
  rejected: ["approved"],
  agreement_sent: [],
  agreed: ["product_shipped"],
  product_shipped: ["content_received"],
  content_received: ["completed"],
  completed: [],
};

export type Creator = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  instagram_handle: string;
  follower_count: number;
  category: string | null;
  city: string | null;
  status: CreatorStatus;
  score: number | null;
  score_reasons: string[] | null;
  recommendation: "approve" | "review" | "reject" | null;
  product_name: string | null;
  product_shipped_at: string | null;
  coupon_code: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function getCreators(): Promise<Creator[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Creator[];
}

export async function getCreatorById(id: string): Promise<Creator | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("creators").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Creator) ?? null;
}

/** Short, memorable, shareable — reuses the exact code shape the customer referral program already generates (see lib/referrals.ts randomCode). */
function randomCouponCode(handle: string) {
  const base = handle.replace(/^@/, "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase();
  return base || Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Creates a flat-discount coupon for an approved creator by reusing the
 * existing coupon_codes engine unchanged (same table checkout already
 * resolves discounts against) — this is the creator's whole attribution
 * mechanism: their code shows up in coupon_redemptions exactly like any
 * other coupon, so "creator X drove Y orders / Z revenue" is a normal join,
 * no separate attribution system needed. Falls back to a random suffix on
 * a handle collision.
 */
export async function getOrCreateCreatorCouponCode(creatorId: string, discountRupees: number): Promise<string> {
  const supabase = getSupabaseServerClient();
  const { data: creator, error } = await supabase
    .from("creators")
    .select("instagram_handle, coupon_code")
    .eq("id", creatorId)
    .single();
  if (error) throw error;
  if (creator.coupon_code) return creator.coupon_code as string;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = attempt === 0 ? randomCouponCode(creator.instagram_handle) : `${randomCouponCode(creator.instagram_handle)}${attempt}`;
    const { error: insertError } = await supabase.from("coupon_codes").insert({
      code,
      discount_type: "flat",
      discount_value: discountRupees,
    });
    if (!insertError) {
      await supabase.from("creators").update({ coupon_code: code }).eq("id", creatorId);
      return code;
    }
  }
  throw new Error("Could not generate a unique creator coupon code");
}
