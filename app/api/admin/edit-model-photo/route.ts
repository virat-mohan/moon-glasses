import { NextResponse } from "next/server";
import { editModelPhoto } from "@/lib/image-gen";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.imageUrl || !body?.instructions?.trim()) {
    return NextResponse.json({ error: "Missing imageUrl or instructions" }, { status: 400 });
  }

  try {
    const url = await editModelPhoto({
      imageUrl: body.imageUrl,
      instructions: body.instructions,
      productName: body.productName,
      chapterSlug: body.chapterSlug,
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("Failed to edit model photo", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not edit model photo" },
      { status: 500 }
    );
  }
}
