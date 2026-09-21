import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getMasterInventoryChapters } from "@/lib/chapters-dynamic";

export async function GET() {
  const chapters = await getMasterInventoryChapters();
  return NextResponse.json({ chapters });
}

/** Updates one dynamic_chapters row's collection/live/price/model_image — the fields /admin/master-inventory lets you change inline. */
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.live === "boolean") patch.live = body.live;
  if (body.collection === "core" || body.collection === "limited") patch.collection = body.collection;
  if (typeof body.price === "number") patch.price = body.price;
  if (typeof body.modelImage === "string" || body.modelImage === null) patch.model_image = body.modelImage;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("dynamic_chapters").update(patch).eq("slug", body.slug);
    if (error) throw error;

    // "/" and /limited-series are ISR-cached (revalidate: 3600) — without
    // this, a Publish/Unpublish here wouldn't show up on the live site for
    // up to an hour.
    revalidatePath("/");
    revalidatePath("/limited-series");
    revalidatePath(`/chapter/${body.slug}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update master inventory row", err);
    return NextResponse.json({ error: "Could not update" }, { status: 500 });
  }
}
