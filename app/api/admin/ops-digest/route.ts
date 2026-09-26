import { NextResponse } from "next/server";
import { previewOpsDigest } from "@/lib/ops-digest";

/**
 * Yesterday's digest for the admin card, and a preview of the email.
 * Read-only: this route never sends anything.
 *   (default)       JSON for components/admin/OpsDigestCard
 *   ?format=html    the email exactly as it would arrive
 *   ?format=text    its plain-text alternative
 */
export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format");

  try {
    const { digest, subject, html, text } = await previewOpsDigest();
    if (format === "html") {
      const page = `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="color-scheme" content="light only" /><title>${subject.replace(/</g, "&lt;")}</title></head><body style="margin:0;background:#f4ead4;">${html}</body></html>`;
      return new NextResponse(page, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
    }
    if (format === "text") {
      return new NextResponse(`Subject: ${subject}\n\n${text}`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ ...digest, subject });
  } catch (err) {
    console.error("Failed to compute ops digest", err);
    return NextResponse.json({ error: "Could not load digest" }, { status: 500 });
  }
}
