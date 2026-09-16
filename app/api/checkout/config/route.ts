import { NextResponse } from "next/server";
import { getRazorpayCredentials } from "@/lib/razorpay";
import { getCodAdvanceRupees } from "@/lib/order-pricing";

export async function GET() {
  const creds = await getRazorpayCredentials();
  const codAdvanceRupees = await getCodAdvanceRupees();
  return NextResponse.json({
    razorpayEnabled: !!creds,
    razorpayKeyId: creds?.keyId ?? null,
    codAdvanceRupees,
  });
}
