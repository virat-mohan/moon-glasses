import { NextResponse } from "next/server";
import { getRazorpayCredentials } from "@/lib/razorpay";
import { getCodAdvanceRupees } from "@/lib/order-pricing";
import { getUpiPaymentConfig } from "@/lib/upi-payment";

export async function GET() {
  const creds = await getRazorpayCredentials();
  const codAdvanceRupees = await getCodAdvanceRupees();
  const upi = await getUpiPaymentConfig();
  return NextResponse.json({
    razorpayEnabled: !!creds,
    razorpayKeyId: creds?.keyId ?? null,
    codAdvanceRupees,
    upiEnabled: !!upi,
    upiId: upi?.upiId ?? null,
    upiQrImageUrl: upi?.qrImageUrl ?? null,
  });
}
