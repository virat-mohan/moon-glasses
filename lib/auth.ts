import crypto from "crypto";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase";
import { sendOtpViaMsg91 } from "@/lib/msg91";
import { sendOtpEmail } from "@/lib/email";

export const SESSION_COOKIE_NAME = "moonglasses_session";
const OTP_TTL_MINUTES = 10;
const SESSION_TTL_DAYS = 30;

export type Customer = {
  id: string;
  phone: string | null;
  name: string | null;
  email: string | null;
  newsletter_subscribed: boolean;
  created_at: string;
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "").slice(-10);
}

/**
 * Generates a 6-digit code, stores it, and sends it. Only one of
 * phone/email is actually required — whichever is given is where the code
 * goes (email via Brevo, phone via MSG91, both attempted if both given).
 * Checkout collects a phone/address on every order regardless of account,
 * so an email-only account never blocks shipping later.
 */
export async function requestOtp(rawPhone: string | null, rawEmail: string | null) {
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  const email = rawEmail?.trim() || null;

  if (phone && phone.length !== 10) throw new Error("Enter a valid 10-digit phone number");
  if (email && !email.includes("@")) throw new Error("Enter a valid email address");
  if (!phone && !email) throw new Error("Enter a phone number or an email address");

  const code = String(crypto.randomInt(100000, 999999));
  const supabase = getSupabaseServerClient();

  const { error } = await supabase.from("otp_codes").insert({
    phone,
    email,
    code,
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString(),
  });
  if (error) throw error;

  // WhatsApp-first: a phone number gets the code via WhatsApp only; email is
  // the fallback channel, used only when there's no phone at all.
  const whatsappSent = phone ? await sendOtpViaMsg91(phone, code) : false;
  const emailSent = !whatsappSent && email ? await sendOtpEmail(email, code) : false;
  const sent = emailSent || whatsappSent;
  if (!sent) {
    // Nothing configured yet (or delivery failed) — surface the code so the
    // flow is still testable end-to-end.
    console.log(`[dev only] OTP for ${phone ?? "(no phone)"} / ${email ?? "(no email)"}: ${code}`);
  }

  return { sent };
}

/**
 * Verifies a code, creating the customer record on first-ever login, and
 * returns a session token to set as an httpOnly cookie. Never throws for
 * "wrong code" — returns null so the caller can show a normal error instead
 * of a 500. Looks the OTP row up by whichever of phone/email was actually
 * used to request it (echoed back by the client) plus the code itself.
 */
export async function verifyOtp(rawPhone: string | null, rawEmail: string | null, code: string) {
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  const email = rawEmail?.trim() || null;
  if (!phone && !email) return null;

  const supabase = getSupabaseServerClient();

  let query = supabase.from("otp_codes").select("id, phone, email, expires_at, consumed").eq("code", code);
  query = phone ? query.eq("phone", phone) : query.eq("email", email as string);

  const { data: otp } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (!otp || otp.consumed || new Date(otp.expires_at) < new Date()) return null;

  await supabase.from("otp_codes").update({ consumed: true }).eq("id", otp.id);

  // Look up by phone first (if given), then email — an existing account
  // matching either counts as "found." A rare edge case (someone previously
  // signed up phone-only under one record and email-only under another,
  // then logs in with both) isn't merged here — that'd need a dedicated
  // account-merge flow, out of scope for now.
  let existing: Customer | null = null;
  if (otp.phone) {
    const { data } = await supabase.from("customers").select("*").eq("phone", otp.phone).maybeSingle();
    existing = data as Customer | null;
  }
  if (!existing && otp.email) {
    const { data } = await supabase.from("customers").select("*").eq("email", otp.email).maybeSingle();
    existing = data as Customer | null;
  }

  let customer = existing;
  if (!customer) {
    const { data: created, error } = await supabase
      .from("customers")
      .insert({ phone: otp.phone ?? null, email: otp.email ?? null })
      .select()
      .single();
    if (error) throw error;
    customer = created as Customer;
  } else {
    // Keep contact info current — this is the most reliable place it's
    // re-collected, on every login.
    const patch: Record<string, string> = {};
    if (otp.email && otp.email !== customer.email) patch.email = otp.email;
    if (otp.phone && otp.phone !== customer.phone) patch.phone = otp.phone;
    if (Object.keys(patch).length > 0) {
      await supabase.from("customers").update(patch).eq("id", customer.id);
      customer = { ...customer, ...patch };
    }
  }

  const token = crypto.randomBytes(32).toString("hex");
  const { error: sessionError } = await supabase.from("customer_sessions").insert({
    token,
    customer_id: customer.id,
    expires_at: new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (sessionError) throw sessionError;

  return { token, customer, isNewCustomer: !existing };
}

/**
 * Same find-or-create logic as verifyOtp's account resolution, but for
 * guest checkout — a shopper who skips OTP still gets a real customer
 * record (matched/deduped by phone, then email) so Miles and referral
 * codes work for them too, without silently logging them into a session
 * they never verified. They just won't see it in /account until they
 * actually verify OTP with the same phone/email later.
 */
export async function findOrCreateCustomerForGuest(
  phone: string | null,
  email: string | null,
  name: string | null
): Promise<Customer | null> {
  if (!phone && !email) return null;
  const supabase = getSupabaseServerClient();

  let existing: Customer | null = null;
  if (phone) {
    const { data } = await supabase.from("customers").select("*").eq("phone", phone).maybeSingle();
    existing = data as Customer | null;
  }
  if (!existing && email) {
    const { data } = await supabase.from("customers").select("*").eq("email", email).maybeSingle();
    existing = data as Customer | null;
  }
  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("customers")
    .insert({ phone, email, name })
    .select()
    .single();
  if (error) {
    // Unique-violation on phone/email means a concurrent checkout (or the
    // OTP flow) won the race and inserted first — re-select rather than
    // treat it as a real failure.
    if (error.code === "23505") {
      const { data: raced } = phone
        ? await supabase.from("customers").select("*").eq("phone", phone).maybeSingle()
        : await supabase.from("customers").select("*").eq("email", email!).maybeSingle();
      if (raced) return raced as Customer;
    }
    console.error("Failed to create guest customer record", error);
    return null;
  }
  return created as Customer;
}

export async function getCustomerFromToken(token: string | undefined | null): Promise<Customer | null> {
  if (!token) return null;
  try {
    const supabase = getSupabaseServerClient();
    const { data: session } = await supabase
      .from("customer_sessions")
      .select("customer_id, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!session || new Date(session.expires_at) < new Date()) return null;

    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("id", session.customer_id)
      .maybeSingle();
    return customer ?? null;
  } catch (err) {
    console.error("Failed to resolve customer session", err);
    return null;
  }
}

/** Server Component / Route Handler helper — reads the session cookie directly. */
export async function getCurrentCustomer(): Promise<Customer | null> {
  const cookieStore = await cookies();
  return getCustomerFromToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export async function destroySession(token: string) {
  const supabase = getSupabaseServerClient();
  await supabase.from("customer_sessions").delete().eq("token", token);
}
