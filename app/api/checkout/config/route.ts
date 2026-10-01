import { NextResponse } from "next/server";
import { getRazorpayCredentials } from "@/lib/razorpay";
import { getCodAdvanceRupees, COD_DISABLED } from "@/lib/order-pricing";
import { getUpiPaymentConfig } from "@/lib/upi-payment";
import { isPostBarterEnabled } from "@/lib/post-barter";
import { getPwapRules } from "@/lib/pwap-rules";
import { getInventoryMap } from "@/lib/inventory";
import { isPwapAvailableForStock } from "@/lib/checkout-rules";

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
  const postBarterEnabled = await isPostBarterEnabled();
  const { salesToShip, salesPerFreeCode } = await getPwapRules();
  // Pay With A Post is hidden for any product under the stock floor; the
  // create-order route enforces the same rule server-side.
  const stock = await getInventoryMap();
  const pwapUnavailableSlugs = Object.keys(stock).filter((slug) => !isPwapAvailableForStock(stock[slug]));
  return NextResponse.json({
    razorpayEnabled: !RAZORPAY_DISABLED && !!creds,
    razorpayKeyId: creds?.keyId ?? null,
    codEnabled: !COD_DISABLED,
    codAdvanceRupees,
    upiEnabled: !!upi,
    upiId: upi?.upiId ?? null,
    upiQrImageUrl: upi?.qrImageUrl ?? null,
    postBarterEnabled,
    pwapRules: { salesToShip, salesPerFreeCode },
    pwapUnavailableSlugs,
  });
}
