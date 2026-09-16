import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { sendRestockEmail } from "@/lib/email";
import { sendRestockWhatsApp } from "@/lib/whatsapp-notify";
import { chapters } from "@/lib/chapters";
import { checkAndAlertLowStock } from "@/lib/inventory";
import { getBrandProfile } from "@/lib/brand";

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.chapterSlug || typeof body.stockOnHand !== "number") {
    return NextResponse.json({ error: "Missing chapterSlug or stockOnHand" }, { status: 400 });
  }
  // Floored server-side too — the client already clamps, but stock going
  // negative from a stray typed value (e.g. "-31") must never be possible
  // even if a request bypasses the UI.
  const stockOnHand = Math.max(0, Math.round(body.stockOnHand));

  try {
    const supabase = getSupabaseServerClient();

    const { data: existing } = await supabase
      .from("inventory")
      .select("stock_on_hand")
      .eq("chapter_slug", body.chapterSlug)
      .maybeSingle();
    const wasSoldOut = !existing || existing.stock_on_hand <= 0;

    const { error } = await supabase
      .from("inventory")
      .upsert({ chapter_slug: body.chapterSlug, stock_on_hand: stockOnHand, updated_at: new Date().toISOString() });
    if (error) throw error;

    await checkAndAlertLowStock(body.chapterSlug, stockOnHand);

    // Restock notifications — best-effort, a failed send must never fail
    // the inventory update itself.
    if (wasSoldOut && stockOnHand > 0) {
      try {
        const chapter = chapters.find((c) => c.slug === body.chapterSlug);
        const chapterName = chapter?.name ?? body.chapterSlug;
        const brand = await getBrandProfile();
        const chapterUrl = `${brand.siteUrl.replace(/\/$/, "")}/chapter/${body.chapterSlug}`;
        const { data: pending } = await supabase
          .from("leads")
          .select("id, name, email, phone")
          .eq("chapter_slug", body.chapterSlug)
          .eq("lead_type", "restock_notify")
          .eq("status", "new");

        for (const lead of pending ?? []) {
          // WhatsApp-first: a phone number gets this via WhatsApp only;
          // email is the fallback, used only when there's no phone (or
          // WhatsApp failed to send).
          const whatsappSent = lead.phone
            ? await sendRestockWhatsApp(lead.phone, lead.name, chapterName, chapterUrl)
            : false;
          const emailSent =
            !whatsappSent && lead.email
              ? await sendRestockEmail(lead.email, lead.name, chapterName, body.chapterSlug)
              : false;
          if (whatsappSent || emailSent) {
            await supabase.from("leads").update({ status: "contacted" }).eq("id", lead.id);
          }
        }
      } catch (err) {
        console.error("Failed to send restock notifications", err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update inventory", err);
    return NextResponse.json({ error: "Could not update inventory" }, { status: 500 });
  }
}
