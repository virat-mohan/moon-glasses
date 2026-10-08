import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getUpiPaymentConfig } from "@/lib/upi-payment";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!orderId) {
    return new Response("Missing order ID", { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const cleanId = orderId.replace(/\.png$/i, "");

    // Support either full UUID or 8-char prefix
    let query = supabase.from("orders").select("id, total, upi_amount_paise, payment_status");
    if (cleanId.length === 8) {
      query = query.ilike("id", `${cleanId}%`);
    } else {
      query = query.eq("id", cleanId);
    }

    const { data: order } = await query.maybeSingle();
    if (!order) {
      return new Response("Order not found", { status: 404 });
    }

    const config = await getUpiPaymentConfig();
    const upiId = config?.upiId || "viratmohan-1@okhdfcbank";
    const payeeName = config?.payeeName && config.payeeName !== "Moonglasses" ? config.payeeName : "Virat Mohan";

    const totalPaise = order.upi_amount_paise ? Number(order.upi_amount_paise) : Math.round(Number(order.total) * 100);
    const amount = (totalPaise / 100).toFixed(2);
    const shortOrderNumber = order.id.slice(0, 8).toUpperCase();

    const upiLink =
      `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}` +
      `&am=${amount}&cu=INR&tn=${encodeURIComponent(`Order ${shortOrderNumber}`)}`;

    const pngBuffer = await QRCode.toBuffer(upiLink, {
      type: "png",
      width: 600,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    return new Response(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    console.error("Failed to generate dynamic QR code", orderId, err);
    return new Response("Failed to generate QR code", { status: 500 });
  }
}
