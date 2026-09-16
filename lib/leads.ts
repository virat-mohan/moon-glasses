import { getSupabaseServerClient } from "@/lib/supabase";

export type LeadSource = "meta_dm" | "meta_comment" | "website" | "other";
export type LeadType = "buying" | "collaborating" | "general_enquiry" | "restock_notify";

export async function createLead(input: {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  source: LeadSource;
  leadType?: LeadType | null;
  platform?: "instagram" | "facebook" | null;
  metaUserId?: string | null;
  note?: string | null;
  status?: "new" | "contacted" | "converted" | "closed";
  chapterSlug?: string | null;
}) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      name: input.name ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      source: input.source,
      lead_type: input.leadType ?? null,
      platform: input.platform ?? null,
      meta_user_id: input.metaUserId ?? null,
      note: input.note ?? null,
      status: input.status ?? "new",
      chapter_slug: input.chapterSlug ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Guest checkout (no account/OTP verification) never touches the
 * `customers` table, so without this the CRM never learns who these buyers
 * are — best-effort, a failed lead insert must never fail the order itself.
 */
export async function recordGuestCheckoutLead(input: {
  name: string;
  phone: string | null;
  email: string | null;
  chapterName?: string | null;
}) {
  try {
    await createLead({
      name: input.name,
      phone: input.phone,
      email: input.email,
      source: "website",
      leadType: "buying",
      note: input.chapterName ? `Purchased: ${input.chapterName}` : "Guest checkout purchase",
      status: "converted",
    });
  } catch (err) {
    console.error("Failed to record guest checkout lead", err);
  }
}
