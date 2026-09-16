import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * MSG91's delivery/read status webhook — configure this URL under MSG91
 * dashboard → Settings → DLR/Webhook. Exact payload field names haven't
 * been verified against a live account yet; this reads defensively across
 * the most commonly documented field names. Always logs the raw body so an
 * unrecognized shape is still visible in the logs rather than silently
 * dropped — this is the only place MSG91's real per-message outcome ever
 * surfaces, since its initial API response always says "queued
 * successfully" even for a request that later fails (e.g. an invalid/
 * deleted Flow slug returns 200 immediately, then 404 here).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true });
  console.log("MSG91 webhook received", JSON.stringify(body));

  const messageId = body.request_id ?? body.requestId ?? body.messageId ?? body.message_id;
  const statusCode = body.status_code ?? body.statusCode ?? body.code;
  const rawStatus = (body.status ?? body.event ?? "").toString().toLowerCase();
  const errorDetail =
    body.error ??
    body.errors ??
    body.description ??
    (statusCode && statusCode !== 200 ? `${statusCode} ${rawStatus || "error"}`.trim() : null);

  if (!messageId) return NextResponse.json({ ok: true });

  const patch: Record<string, string> = {};
  if (rawStatus.includes("read") || rawStatus.includes("seen")) {
    patch.status = "read";
    patch.read_at = new Date().toISOString();
  } else if (rawStatus.includes("delivered")) {
    patch.status = "delivered";
    patch.delivered_at = new Date().toISOString();
  } else if (
    rawStatus.includes("fail") ||
    rawStatus.includes("undelivered") ||
    rawStatus.includes("invalid") ||
    (statusCode && Number(statusCode) >= 400)
  ) {
    patch.status = "failed";
  }
  if (errorDetail) {
    patch.error_detail = typeof errorDetail === "string" ? errorDetail : JSON.stringify(errorDetail);
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  try {
    const supabase = getSupabaseServerClient();
    await supabase.from("whatsapp_messages").update(patch).eq("msg91_message_id", messageId);
  } catch (err) {
    console.error("Failed to process MSG91 webhook", err);
  }

  return NextResponse.json({ ok: true });
}
