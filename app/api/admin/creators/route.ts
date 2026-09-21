import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getCreatorById, CREATOR_STATUS_TRANSITIONS, type CreatorStatus } from "@/lib/creators";
import { getOrCreateDraftAgreement } from "@/lib/creator-agreement";
import { getBrandProfile } from "@/lib/brand";
import { sendCreatorApprovedEmail, sendCreatorRejectedEmail } from "@/lib/email";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("creators")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ creators: data ?? [] });
  } catch (err) {
    console.error("Failed to load creators", err);
    return NextResponse.json({ creators: [] }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const id = body?.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const creator = await getCreatorById(id);
    if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

    const supabase = getSupabaseServerClient();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.adminNotes !== undefined) updates.admin_notes = body.adminNotes;
    if (body.productName !== undefined) updates.product_name = body.productName;

    const nextStatus = body.status as CreatorStatus | undefined;
    if (nextStatus) {
      const allowed = CREATOR_STATUS_TRANSITIONS[creator.status];
      if (!allowed.includes(nextStatus)) {
        return NextResponse.json(
          { error: `Cannot move a creator from "${creator.status}" to "${nextStatus}"` },
          { status: 400 }
        );
      }
      updates.status = nextStatus;
      if (nextStatus === "product_shipped") updates.product_shipped_at = new Date().toISOString();
    }

    const { data: updated, error } = await supabase
      .from("creators")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    if (nextStatus === "approved") {
      const brand = await getBrandProfile();
      await getOrCreateDraftAgreement(updated);
      const agreementUrl = `${brand.siteUrl.replace(/\/$/, "")}/creator/agreement/${id}`;
      try {
        await sendCreatorApprovedEmail(updated.email, updated.name, agreementUrl);
      } catch (notifyErr) {
        console.error("Failed to send creator approval email", notifyErr);
      }
    } else if (nextStatus === "rejected") {
      try {
        await sendCreatorRejectedEmail(updated.email, updated.name);
      } catch (notifyErr) {
        console.error("Failed to send creator rejection email", notifyErr);
      }
    }

    return NextResponse.json({ creator: updated });
  } catch (err) {
    console.error("Failed to update creator", err);
    return NextResponse.json({ error: "Could not update creator" }, { status: 500 });
  }
}
