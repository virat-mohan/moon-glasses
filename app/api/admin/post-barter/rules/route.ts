import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getPwapRules, savePwapRules } from "@/lib/pwap-rules";

export async function GET() {
  return NextResponse.json({ rules: await getPwapRules() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Send the rules as JSON" }, { status: 400 });
  }
  const rules = await savePwapRules(body as Record<string, unknown>);
  // Banner and checkout copy show these numbers; refresh cached pages.
  revalidatePath("/", "layout");
  return NextResponse.json({ rules });
}
