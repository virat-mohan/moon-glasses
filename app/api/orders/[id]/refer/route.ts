import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getOrCreateReferralCode } from "@/lib/referrals";
import { getSetting } from "@/lib/settings";
import { sendReferralInviteEmail } from "@/lib/email";
import { sendReferralInviteWhatsApp } from "@/lib/whatsapp-notify";
import { getBrandProfile } from "@/lib/brand";

/**
 * Same as /api/account/refer, but keyed off the order's unguessable UUID
 * instead of a session cookie — same capability-link pattern as the invoice
 * and review pages. A guest checkout gets a real customer record (see
 * findOrCreateCustomerForGuest) but never a session, so without this route
 * sharing a referral code right after checkout would force a guest through
 * OTP login just to send an invite.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const friendName = String(body?.friendName ?? "").trim();
  const friendPhone = String(body?.friendPhone ?? "").trim();
  const friendEmail = String(body?.friendEmail ?? "").trim();

  if (!friendName || (!friendPhone && !friendEmail)) {
    return NextResponse.json({ error: "Enter a name and a phone number or email" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data: order } = await supabase
      .from("orders")
      .select("customer_id, customer_name")
      .eq("id", id)
      .maybeSingle();
    if (!order?.customer_id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const referralCode = await getOrCreateReferralCode(order.customer_id);
    const discountSetting = await getSetting("REFERRAL_DISCOUNT_RUPEES");
    const discountRupees = discountSetting ? Number(discountSetting) : 200;

    // WhatsApp-first: a friend's phone number gets the invite via WhatsApp
    // only; email is the fallback, used only when there's no phone (or
    // WhatsApp failed to send).
    let whatsappSent = false;
    if (friendPhone) {
      const brand = await getBrandProfile();
      const referralUrl = `${brand.siteUrl.replace(/\/$/, "")}/?ref=${referralCode}`;
      whatsappSent = await sendReferralInviteWhatsApp(
        friendPhone,
        friendName,
        order.customer_name ?? "A friend",
        referralUrl
      );
    }
    const emailSent =
      !whatsappSent && friendEmail
        ? await sendReferralInviteEmail(friendEmail, friendName, order.customer_name, referralCode, discountRupees)
        : false;

    if (!emailSent && !whatsappSent) {
      return NextResponse.json(
        { error: "Could not send the invite — check the email/phone and try again" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, emailSent, whatsappSent });
  } catch (err) {
    console.error("Failed to send referral invite from order", id, err);
    return NextResponse.json({ error: "Could not send the invite" }, { status: 500 });
  }
}
