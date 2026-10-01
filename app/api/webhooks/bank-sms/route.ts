import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { BANK_SMS_TOKEN_KEY, handleBankSms } from "@/lib/bank-sms";

/**
 * The owner's phone forwards every bank credit SMS here (iPhone Shortcuts
 * "message received" automation, or an Android SMS-forwarder app), and a
 * matching unpaid UPI order is confirmed automatically — the same thing
 * "Mark Paid" does by hand. Accepts JSON {"text": "..."} or a raw text body.
 * Authenticated by a secret token, as ?token= or an x-sms-token header.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const provided = url.searchParams.get("token") ?? request.headers.get("x-sms-token");
  const { data } = await getSupabaseServerClient().from("app_settings").select("value").eq("key", BANK_SMS_TOKEN_KEY).maybeSingle();
  if (!data?.value || provided !== data.value) {
    // Logged (without the token or message) so a mis-pasted link on the
    // owner's phone is visible in Admin › Orders instead of failing silently.
    await getSupabaseServerClient()
      .from("bank_sms_log")
      .insert({ body: "(rejected: wrong or missing token)", status: provided ? "bad_token" : "no_token" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.text();
  let text = raw;
  try {
    const json = JSON.parse(raw);
    text = String(json.text ?? json.message ?? json.body ?? json.sms ?? raw);
  } catch {
    // plain-text body
  }
  if (!text.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  try {
    return NextResponse.json(await handleBankSms(text));
  } catch (err) {
    console.error("Bank SMS handling failed", err);
    return NextResponse.json({ error: "Could not process" }, { status: 500 });
  }
}
