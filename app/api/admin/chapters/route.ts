import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.series || !body?.story || !body?.images?.length || !body?.primaryImage) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const slug = slugify(body.name);

    const { error } = await supabase.from("dynamic_chapters").insert({
      slug,
      name: body.name,
      series: body.series,
      story: body.story,
      price: body.price ?? 1399,
      verified_on_site: body.verifiedOnSite ?? true,
      images: body.images,
      primary_image: body.primaryImage,
    });

    if (error) throw error;

    // Also seed an inventory row so stock badges work immediately.
    await supabase
      .from("inventory")
      .upsert({ chapter_slug: slug, stock_on_hand: body.stockOnHand ?? 0 });

    return NextResponse.json({ slug });
  } catch (err) {
    console.error("Failed to create chapter", err);
    return NextResponse.json({ error: "Could not create chapter" }, { status: 500 });
  }
}
