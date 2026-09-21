import { NextResponse } from "next/server";
import { importFromShopifyUrl } from "@/lib/shopify-import";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  try {
    const result = await importFromShopifyUrl(body.url);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to import from URL", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not import from that URL" },
      { status: 500 }
    );
  }
}
