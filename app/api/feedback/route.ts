import { NextResponse } from "next/server";
import { clientIp, submitStoreFeedback } from "@/lib/review-submit";
import { cleanText, makeLimiter, MAX_CONTACT_CHARS, MAX_NAME_CHARS, MAX_REVIEW_CHARS, parseRating } from "@/lib/review-core";

export const dynamic = "force-dynamic";
const limited = makeLimiter(3, 10 * 60 * 1000);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.website === "string" && body.website.trim() !== "") return NextResponse.json({ ok: true });
  if (limited(clientIp(request))) return NextResponse.json({ error: "Too many tries, please wait a few minutes" }, { status: 429 });
  const rating = parseRating(body?.rating);
  if (!rating) return NextResponse.json({ error: "Please pick a star rating" }, { status: 400 });
  try {
    await submitStoreFeedback({
      rating,
      name: cleanText(body?.name, MAX_NAME_CHARS),
      text: cleanText(body?.text, MAX_REVIEW_CHARS),
      contact: cleanText(body?.contact, MAX_CONTACT_CHARS),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to save feedback", err);
    return NextResponse.json({ error: "Could not save your feedback" }, { status: 500 });
  }
}
