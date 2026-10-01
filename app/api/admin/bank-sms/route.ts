import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getBrandProfile } from "@/lib/brand";
import { BANK_SMS_TOKEN_KEY } from "@/lib/bank-sms";

/** The owner's private SMS-forwarding URL (token created on first visit) plus the latest forwarded SMS and what each matched. */
export async function GET() {
  const supabase = getSupabaseServerClient();
  let { data: row } = await supabase.from("app_settings").select("value").eq("key", BANK_SMS_TOKEN_KEY).maybeSingle();
  if (!row?.value) {
    const value = randomBytes(24).toString("hex");
    await supabase.from("app_settings").upsert({ key: BANK_SMS_TOKEN_KEY, value }, { onConflict: "key" });
    row = { value };
  }
  const brand = await getBrandProfile();
  const base = brand.siteUrl.replace(/\/$/, "").replace("://moon-glasses.store", "://www.moon-glasses.store");
  const { data: recent } = await supabase
    .from("bank_sms_log")
    .select("created_at, amount_paise, upi_ref, payer_name, status, matched_order_id")
    .order("created_at", { ascending: false })
    .limit(15);
  return NextResponse.json({ url: `${base}/api/webhooks/bank-sms?token=${row.value}`, recent: recent ?? [] });
}
