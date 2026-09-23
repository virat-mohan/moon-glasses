import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { STORAGE_REF_PREFIX } from "@/lib/whatsapp-cloud-inbound";

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

  // Screenshots from Meta live in a private bucket — hand the admin a
  // one-hour signed link rather than exposing a permanent public URL.
  const rows = await Promise.all(
    (data ?? []).map(async (row) => {
      if (!row.media_url?.startsWith(STORAGE_REF_PREFIX)) return row;
      const [bucket, ...rest] = row.media_url.slice(STORAGE_REF_PREFIX.length).split("/");
      const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(rest.join("/"), 3600);
      return { ...row, media_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ rows });
}
