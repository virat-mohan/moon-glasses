import { NextResponse } from "next/server";
import { clientIp, submitOrderReviews } from "@/lib/review-submit";
import { cleanText, makeLimiter, MAX_NAME_CHARS, MAX_REVIEW_CHARS, parseRating } from "@/lib/review-core";

export const dynamic = "force-dynamic";
const limited = makeLimiter(8, 10 * 60 * 1000);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  // Honeypot: a real person never fills the hidden field. Pretend it worked.
  if (typeof body?.website === "string" && body.website.trim() !== "") return NextResponse.json({ ok: true, saved: 0 });
  if (limited(clientIp(request))) return NextResponse.json({ error: "Too many tries, please wait a few minutes" }, { status: 429 });

  const orderId = String(body?.orderId ?? "").trim();
  const rawEntries: unknown[] = Array.isArray(body?.entries) ? body.entries.slice(0, 20) : [];
  const entries = rawEntries.flatMap((e) => {
    const o = e as { chapterSlug?: unknown; rating?: unknown; text?: unknown };
    const rating = parseRating(o?.rating);
    const chapterSlug = typeof o?.chapterSlug === "string" ? o.chapterSlug.trim().slice(0, 120) : "";
    return rating && chapterSlug ? [{ chapterSlug, rating, text: cleanText(o.text, MAX_REVIEW_CHARS) }] : [];
  });
  if (!UUID.test(orderId) || entries.length === 0) return NextResponse.json({ error: "Please pick a star rating" }, { status: 400 });

  try {
    const r = await submitOrderReviews({ orderId, name: cleanText(body?.name, MAX_NAME_CHARS), entries });
    return NextResponse.json(r.body, { status: r.status });
  } catch (err) {
    console.error("Failed to save review", err);
    return NextResponse.json({ error: "Could not save your review" }, { status: 500 });
  }
}
