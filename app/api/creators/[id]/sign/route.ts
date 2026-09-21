import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getCreatorById, getOrCreateCreatorCouponCode } from "@/lib/creators";
import { generateSignedAgreementPdf, uploadSignedAgreementPdf } from "@/lib/creator-agreement";
import { getBrandProfile } from "@/lib/brand";
import { sendCreatorAgreementSignedEmail } from "@/lib/email";
import { getSetting } from "@/lib/settings";

/**
 * The whole e-signature flow: a creator who has been approved types their
 * full legal name and confirms — that typed name, the request's IP, and a
 * server timestamp become the signature record, and a PDF is generated and
 * stored as the durable signed artifact. No third-party e-signature vendor.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const signedName = String(body?.signedName ?? "").trim();
  if (!signedName) return NextResponse.json({ error: "Type your full name to sign" }, { status: 400 });

  try {
    const creator = await getCreatorById(id);
    if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    if (creator.status !== "approved") {
      return NextResponse.json({ error: "This creator isn't ready to sign yet" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: agreement } = await supabase
      .from("creator_agreements")
      .select("*")
      .eq("creator_id", id)
      .order("created_at", { ascending: false })
      .maybeSingle();
    if (!agreement) return NextResponse.json({ error: "No agreement found to sign" }, { status: 404 });
    if (agreement.signed_at) return NextResponse.json({ error: "This agreement is already signed" }, { status: 400 });

    const signerIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const signedAt = new Date().toISOString();
    const brand = await getBrandProfile();

    const pdfBytes = await generateSignedAgreementPdf({
      agreementHtml: agreement.agreement_html,
      creatorName: creator.name,
      instagramHandle: creator.instagram_handle,
      signedName,
      signedAt,
      signerIp,
      brandName: brand.brandName,
    });
    const pdfUrl = await uploadSignedAgreementPdf(id, pdfBytes);

    await supabase
      .from("creator_agreements")
      .update({ signed_name: signedName, signed_at: signedAt, signer_ip: signerIp, pdf_url: pdfUrl })
      .eq("id", agreement.id);

    await supabase.from("creators").update({ status: "agreed", updated_at: signedAt }).eq("id", id);

    let couponCode: string | null = null;
    try {
      const discountSetting = await getSetting("REFERRAL_DISCOUNT_RUPEES");
      const discountRupees = discountSetting ? Number(discountSetting) : 200;
      couponCode = await getOrCreateCreatorCouponCode(id, discountRupees);
    } catch (couponErr) {
      console.error("Failed to generate creator coupon code", couponErr);
    }

    try {
      await sendCreatorAgreementSignedEmail(creator.email, creator.name, couponCode);
    } catch (notifyErr) {
      console.error("Failed to send creator agreement-signed email", notifyErr);
    }

    return NextResponse.json({ ok: true, pdfUrl, couponCode });
  } catch (err) {
    console.error("Failed to sign creator agreement", err);
    return NextResponse.json({ error: "Could not sign the agreement" }, { status: 500 });
  }
}
