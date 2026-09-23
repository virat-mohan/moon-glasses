import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("whatsapp_payment_confirmations")
    .select(
      "id, phone, media_url, extracted_amount_rupees, extracted_utr, extracted_payee, matched_order_id, match_status, note, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}
