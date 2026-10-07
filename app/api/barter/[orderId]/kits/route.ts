import { NextResponse } from "next/server";
import { createAnotherKit, getOrderKits, kitImageUrl, resolveBarterAccess } from "@/lib/pwap-kits";

/** Kits for the signed-in customer's order. 401 without a matching session. */
export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const found = await resolveBarterAccess(orderId);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (found.access !== "ok") return NextResponse.json({ error: "Sign in to see your posts" }, { status: 401 });
  const kits = await getOrderKits(found.order);
  return NextResponse.json({ kits: kits.map((k) => ({ id: k.id, code: k.code, sales: k.sales_count, url: kitImageUrl(k.image_path) })) });
}

/** "Get another post": a new image and a new code on the same order, up to the cap. */
export async function POST(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const found = await resolveBarterAccess(orderId);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (found.access !== "ok") return NextResponse.json({ error: "Sign in to make another post" }, { status: 401 });
  const result = await createAnotherKit(found.order);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason === "cap" ? "cap" : "failed" }, { status: result.reason === "cap" ? 409 : 500 });
  }
  const k = result.kit;
  return NextResponse.json({ kit: { id: k.id, code: k.code, sales: 0, url: kitImageUrl(k.image_path) } });
}
