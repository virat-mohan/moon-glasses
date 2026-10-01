import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { syncApprovedTemplateSettings } from "@/lib/msg91-templates";

/** Hourly: turn on WhatsApp templates as Meta approves them (utility ones only if still utility). */
export async function GET(request: Request) {
  if (!(await isCronAuthorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await syncApprovedTemplateSettings());
}
