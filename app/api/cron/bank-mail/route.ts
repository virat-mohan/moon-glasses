import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { checkBankMail } from "@/lib/bank-mail";

export const maxDuration = 60;

/** Every minute: confirm UPI orders from new HDFC credit emails in the owner's Yahoo inbox. */
export async function GET(request: Request) {
  if (!(await isCronAuthorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await checkBankMail());
}
