import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData.getAll("files") as File[];
  const slug = formData.get("slug") as string;

  if (!slug || files.length === 0) {
    return NextResponse.json({ error: "Missing slug or files" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const urls: string[] = [];

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${slug}/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage
        .from("chapter-images")
        .upload(path, bytes, { contentType: file.type, upsert: false });

      if (error) throw error;

      const { data } = supabase.storage.from("chapter-images").getPublicUrl(path);
      urls.push(data.publicUrl);
    }

    return NextResponse.json({ urls });
  } catch (err) {
    console.error("Upload failed", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
