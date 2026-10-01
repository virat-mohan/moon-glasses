import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, getAdminSessionRole } from "@/lib/admin-auth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getBrandProfile } from "@/lib/brand";
import { BANK_SMS_TOKEN_KEY } from "@/lib/bank-sms";
import { BANK_MAIL_KEYS, checkBankMail } from "@/lib/bank-mail";

/** The owner's private SMS-forwarding URL (token created on first visit) plus the latest forwarded SMS and what each matched. */
// Owner only: this exposes the private alert link and takes the mailbox password.
async function isOwner() {
  return (await getAdminSessionRole((await cookies()).get(ADMIN_COOKIE)?.value)) === "owner";
}

export async function GET() {
  if (!(await isOwner())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
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
  const { data: mailRows } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", [BANK_MAIL_KEYS.address, BANK_MAIL_KEYS.appPassword, BANK_MAIL_KEYS.lastCheck]);
  const m = Object.fromEntries((mailRows ?? []).map((r) => [r.key, r.value as string]));
  return NextResponse.json({
    url: `${base}/api/webhooks/bank-sms?token=${row.value}`,
    recent: recent ?? [],
    mail: {
      address: m[BANK_MAIL_KEYS.address] ?? null,
      hasPassword: !!m[BANK_MAIL_KEYS.appPassword],
      lastCheck: m[BANK_MAIL_KEYS.lastCheck] ? JSON.parse(m[BANK_MAIL_KEYS.lastCheck]) : null,
    },
  });
}

/** Save the Yahoo inbox credentials (password is write-only), or run a check now. */
export async function POST(request: Request) {
  if (!(await isOwner())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const supabase = getSupabaseServerClient();
  if (body.action === "check") return NextResponse.json(await checkBankMail());
  const rows: { key: string; value: string }[] = [];
  if (typeof body.address === "string" && body.address.trim()) rows.push({ key: BANK_MAIL_KEYS.address, value: body.address.trim() });
  if (typeof body.appPassword === "string" && body.appPassword.trim())
    rows.push({ key: BANK_MAIL_KEYS.appPassword, value: body.appPassword.replace(/\s+/g, "") });
  if (rows.length) await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
  return NextResponse.json(await checkBankMail());
}
