import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("marketing_assets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ assets: data ?? [] });
  } catch (err) {
    console.error("Failed to list marketing assets", err);
    return NextResponse.json({ assets: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData.getAll("files") as File[];
  const label = (formData.get("label") as string) ?? "";
  const tags = ((formData.get("tags") as string) ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const inserted = [];

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("ad-creatives")
        .upload(`real/${path}`, bytes, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("ad-creatives")
        .getPublicUrl(`real/${path}`);

      const { data, error } = await supabase
        .from("marketing_assets")
        .insert({ url: publicUrlData.publicUrl, label: label || file.name, tags })
        .select()
        .single();
      if (error) throw error;
      inserted.push(data);
    }

    return NextResponse.json({ assets: inserted });
  } catch (err) {
    console.error("Failed to upload marketing assets", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("marketing_assets").delete().eq("id", body.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete marketing asset", err);
    return NextResponse.json({ error: "Could not delete" }, { status: 500 });
  }
}
