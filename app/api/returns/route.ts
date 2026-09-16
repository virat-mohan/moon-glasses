import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { isValidReturnReason, isWithinReturnWindow } from "@/lib/returns";

export async function POST(request: Request) {
  const formData = await request.formData();
  const orderId = String(formData.get("orderId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const photo = formData.get("photo") as File | null;

  if (!orderId || !isValidReturnReason(reason) || !note) {
    return NextResponse.json({ error: "Missing order, a valid reason, or details" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();

    // Never trust the client on window eligibility — recompute the same way
    // the /return/[orderId] page itself does.
    const { data: order } = await supabase.from("orders").select("id, delivered_at").eq("id", orderId).maybeSingle();
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!(await isWithinReturnWindow(order.delivered_at))) {
      return NextResponse.json({ error: "This order is outside its return window" }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from("return_requests")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "A return request already exists for this order" }, { status: 400 });
    }

    let photoUrl: string | null = null;
    if (photo && photo.size > 0) {
      try {
        const bytes = await photo.arrayBuffer();
        const ext = photo.name.split(".").pop() || "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("return-photos")
          .upload(path, bytes, { contentType: photo.type, upsert: false });
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from("return-photos").getPublicUrl(path);
        photoUrl = publicUrlData.publicUrl;
      } catch (err) {
        // A missing/misconfigured bucket shouldn't block the request itself —
        // the reason/note text is what actually matters for the review.
        console.error("Return photo upload failed, continuing without it", err);
      }
    }

    const { error } = await supabase.from("return_requests").insert({
      order_id: orderId,
      reason,
      note,
      photo_url: photoUrl,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to save return request", orderId, err);
    return NextResponse.json({ error: "Could not submit your return request" }, { status: 500 });
  }
}
