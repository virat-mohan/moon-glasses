import { NextResponse } from "next/server";
import { generateModelPhoto } from "@/lib/image-gen";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.referenceImageUrls?.length || !body?.gender) {
    return NextResponse.json({ error: "Missing referenceImageUrls or gender" }, { status: 400 });
  }

  try {
    const url = await generateModelPhoto({
      referenceImageUrls: body.referenceImageUrls,
      gender: body.gender === "female" ? "female" : "male",
      productName: body.productName,
      chapterSlug: body.chapterSlug,
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("Failed to generate model photo", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not generate model photo" },
      { status: 500 }
    );
  }
}
