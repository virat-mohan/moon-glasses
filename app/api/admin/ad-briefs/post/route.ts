import { NextResponse } from "next/server";
import { postBriefToInstagram } from "@/lib/ad-brief-publish";

/** Publishes an ad brief's copy/image straight to Instagram as an organic feed post — no ad spend, no Meta campaign created. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const taggedUsernames: string[] | undefined = Array.isArray(body.taggedUsernames)
      ? body.taggedUsernames.filter((u: unknown): u is string => typeof u === "string" && u.trim().length > 0)
      : undefined;
    const { postId } = await postBriefToInstagram(body.id, taggedUsernames);
    return NextResponse.json({ ok: true, postId });
  } catch (err) {
    console.error("Failed to post ad brief to Instagram", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not post to Instagram" },
      { status: 500 }
    );
  }
}
