import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, getAdminSessionRole } from "@/lib/admin-auth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getBrandProfile } from "@/lib/brand";
import { BANK_SMS_TOKEN_KEY } from "@/lib/bank-sms";
import { checkBankMail, imapHostFor, readBankMailAccounts, writeBankMailAccounts } from "@/lib/bank-mail";

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
  const accounts = await readBankMailAccounts();
  return NextResponse.json({
    url: `${base}/api/webhooks/bank-sms?token=${row.value}`,
    recent: recent ?? [],
    mailboxes: accounts.map((a) => ({ address: a.address, lastCheck: a.lastCheck ?? null })),
  });
}

/** Save the Yahoo inbox credentials (password is write-only), or run a check now. */
export async function POST(request: Request) {
  if (!(await isOwner())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (body.action === "check") return NextResponse.json(await checkBankMail());
  const accounts = await readBankMailAccounts();
  if (body.action === "remove" && typeof body.address === "string") {
    await writeBankMailAccounts(accounts.filter((a) => a.address !== body.address));
    return NextResponse.json({ ok: true });
  }
  const address = typeof body.address === "string" ? body.address.trim().toLowerCase() : "";
  const appPassword = typeof body.appPassword === "string" ? body.appPassword.replace(/\s+/g, "") : "";
  if (!address || !appPassword) return NextResponse.json({ error: "Email and app password are both needed" }, { status: 400 });
  if (!imapHostFor(address)) return NextResponse.json({ error: "Only Gmail and Yahoo inboxes are supported" }, { status: 400 });
  // Same inbox again replaces its password; start from "now" so old mail isn't replayed.
  await writeBankMailAccounts([...accounts.filter((a) => a.address !== address), { address, appPassword }]);
  return NextResponse.json(await checkBankMail());
}
