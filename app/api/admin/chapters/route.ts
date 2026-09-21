import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
      model_image: body.modelImage ?? null,
      collection: body.collection === "limited" ? "limited" : "core",
      // This form existed before the draft/publish (`live`) column did, and
      // always meant "publish this now" — default to live so it keeps that
      // behavior. Explicitly pass live:false to add it as a draft instead
      // (e.g. from a future "save as draft" option on this same form).
      live: body.live !== false,
    });

    if (error) throw error;

    // Also seed an inventory row so stock badges work immediately.
    await supabase
      .from("inventory")
      .upsert({ chapter_slug: slug, stock_on_hand: body.stockOnHand ?? 0 });

    // "/" and /limited-series are ISR-cached (revalidate: 3600) — without
    // this, a newly-added LIVE product wouldn't show up on the site for up
    // to an hour.
    revalidatePath("/");
    revalidatePath("/limited-series");
    revalidatePath(`/chapter/${slug}`);

    return NextResponse.json({ slug });
  } catch (err) {
    console.error("Failed to create chapter", err);
    return NextResponse.json({ error: "Could not create chapter" }, { status: 500 });
  }
}
