import { NextResponse } from "next/server";
import { classifyPostBarterApplicant, generateGiftFirstVerificationCode } from "@/lib/post-barter";

/** Open to anyone — this never rejects. It just previews which tier a handle will land in, so the checkout UI can show the right expectation before they submit. For gift_first, also hands back a short-lived ownership code (see verify-ownership) the shopper needs to prove they actually control that handle before anything ships. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const instagramHandle = String(body?.instagramHandle ?? "").trim();
  if (!instagramHandle) {
    return NextResponse.json({ error: "Enter your Instagram handle" }, { status: 400 });
  }

  const result = await classifyPostBarterApplicant(instagramHandle);
  const verificationCode = result.tier === "gift_first" ? generateGiftFirstVerificationCode(instagramHandle) : null;
  return NextResponse.json({ ...result, verificationCode });
}
