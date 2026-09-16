import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";

export const DEFAULT_PREORDER_AMOUNT_RUPEES = 500;

export async function getPreorderAmountRupees(): Promise<number> {
  const override = await getSetting("PREORDER_AMOUNT_RUPEES");
  const n = override ? Number(override) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PREORDER_AMOUNT_RUPEES;
}

export async function createPendingPreorder(input: {
  name: string;
  email: string;
  phone?: string | null;
  chapterSlug?: string | null;
  amountRupees: number;
  razorpayOrderId: string;
}) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("preorders")
    .insert({
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone ?? null,
      chapter_slug: input.chapterSlug ?? null,
      amount_rupees: input.amountRupees,
      razorpay_order_id: input.razorpayOrderId,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markPreorderPaid(razorpayOrderId: string, razorpayPaymentId: string) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("preorders")
    .update({ status: "paid", razorpay_payment_id: razorpayPaymentId })
    .eq("razorpay_order_id", razorpayOrderId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listPreorders() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("preorders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPaidUnnotifiedEmails(): Promise<{ email: string; name: string }[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("preorders")
    .select("email, name")
    .eq("status", "paid")
    .is("notified_at", null);
  if (error) throw error;
  return data ?? [];
}

export async function markAllPaidNotified() {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("preorders")
    .update({ notified_at: new Date().toISOString() })
    .eq("status", "paid")
    .is("notified_at", null);
  if (error) throw error;
}
