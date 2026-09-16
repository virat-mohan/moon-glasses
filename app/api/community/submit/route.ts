import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { sendExplorerSubmissionNotificationEmail } from "@/lib/email";

export async function POST(request: Request) {
  const formData = await request.formData();
  const photo = formData.get("photo") as File | null;
  const testimonial = formData.get("testimonial") as string | null;
  const location = formData.get("location") as string | null;
  const email = formData.get("email") as string | null;

  if (!photo || !testimonial) {
    return NextResponse.json({ error: "Missing photo or testimonial" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const bytes = await photo.arrayBuffer();
    const ext = photo.name.split(".").pop() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("community-submissions")
      .upload(path, bytes, { contentType: photo.type, upsert: false });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from("community-submissions")
      .getPublicUrl(path);

    const { error } = await supabase.from("explorer_submissions").insert({
      photo_url: publicUrlData.publicUrl,
      testimonial,
      location: location || null,
      email: email || null,
    });
    if (error) throw error;

    try {
      await sendExplorerSubmissionNotificationEmail(publicUrlData.publicUrl, testimonial, location);
    } catch (notifyErr) {
      console.error("Failed to send explorer submission notification email", notifyErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to save explorer submission", err);
    return NextResponse.json({ error: "Could not save submission" }, { status: 500 });
  }
}
