import { NextResponse } from "next/server";
import { createLead } from "@/lib/leads";
import { chapters } from "@/lib/chapters";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const chapterSlug = String(body?.chapterSlug ?? "").trim();

  if (!name || !email || !chapterSlug) {
    return NextResponse.json({ error: "Missing name, email, or chapter" }, { status: 400 });
  }

  const chapter = chapters.find((c) => c.slug === chapterSlug);
  if (!chapter) {
    return NextResponse.json({ error: "Unknown chapter" }, { status: 400 });
  }

  try {
    await createLead({
      name,
      email,
      source: "website",
      leadType: "restock_notify",
      note: `Notify when back in stock: ${chapter.name}`,
      chapterSlug,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to record restock notification request", err);
    return NextResponse.json({ error: "Could not save your request" }, { status: 500 });
  }
}
