import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { generateAndUploadPwapShareCard } from "@/lib/pwap-share-card";
import { getOrderKits, resolveBarterAccess } from "@/lib/pwap-kits";

/**
 * The image for one post kit (?kit=<id>; default the order's first kit). Needs
 * the signed-in customer whose email matches the order (401 otherwise); legacy
 * orders without an email keep the open link for their first kit only.
 * Made on first request if it isn't in storage yet.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const found = await resolveBarterAccess(orderId);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (found.access === "needs_login") return NextResponse.json({ error: "Sign in to see your post" }, { status: 401 });

  const kits = await getOrderKits(found.order);
  const kitId = req.nextUrl.searchParams.get("kit");
  const kit = kitId ? kits.find((k) => k.id === kitId) : kits[0];
  if (!kit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (found.access === "open_legacy" && kit.id !== kits[0].id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = getSupabaseServerClient();
  const existing = supabase.storage.from("ad-creatives").getPublicUrl(kit.image_path).data.publicUrl;
  const head = await fetch(existing, { method: "HEAD" }).catch(() => null);
  const url = head?.ok ? existing : await generateAndUploadPwapShareCard(orderId, kit.code, 0, { path: kit.image_path }).catch(() => null);
  if (!url) return NextResponse.json({ error: "Could not make the post" }, { status: 500 });
  return NextResponse.json({ url });
}
