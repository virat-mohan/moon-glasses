import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, created_at, customer_name, customer_phone, delivery_pincode, status, shipment_status, shiprocket_order_id, shiprocket_shipment_id, shiprocket_awb_code, courier_name"
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ orders: data ?? [] });
  } catch (err) {
    console.error("Failed to list logistics orders", err);
    return NextResponse.json({ orders: [] }, { status: 500 });
  }
}
