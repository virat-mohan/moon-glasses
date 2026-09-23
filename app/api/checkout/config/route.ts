import { NextResponse } from "next/server";
import { getRazorpayCredentials } from "@/lib/razorpay";
import { getCodAdvanceRupees } from "@/lib/order-pricing";
import { getUpiPaymentConfig } from "@/lib/upi-payment";

// Turned off at the request of the business owner (keys are configured and
// the integration itself works — verified end to end against a real test
// order — but checkout should route through UPI QR for now instead). Kept
// as a single hardcoded `false` here, rather than deleting the Razorpay
// integration, so every consumer of this endpoint (the "Pay in full"
// section, the checkout.js script tag, the submit-button dispatch) hides
// consistently without touching each one — re-enable by reverting this one
// line back to `!!creds`.
const RAZORPAY_DISABLED = true;

export async function GET() {
  const creds = await getRazorpayCredentials();
  const codAdvanceRupees = await getCodAdvanceRupees();
  const upi = await getUpiPaymentConfig();
  return NextResponse.json({
    razorpayEnabled: !RAZORPAY_DISABLED && !!creds,
    razorpayKeyId: creds?.keyId ?? null,
    codAdvanceRupees,
    upiEnabled: !!upi,
    upiId: upi?.upiId ?? null,
    upiQrImageUrl: upi?.qrImageUrl ?? null,
  });
}
