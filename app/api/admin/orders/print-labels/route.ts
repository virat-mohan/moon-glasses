import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { buildDuplicatedLabelSheet } from "@/lib/label-print";

/** Builds a landscape-A4 PDF with one page per selected order, each showing that order's own label printed twice (two copies to cut apart) — see lib/label-print.ts. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  // Accepts either repeated ?ids=a&ids=b (a plain HTML checkbox form submits
  // this way) or one comma-separated ?ids=a,b.
  const ids = params.getAll("ids").flatMap((v) => v.split(",")).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ error: "Missing ids" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, shiprocket_shipment_id")
      .in("id", ids);
    if (error) throw error;
    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: "No matching orders found" }, { status: 404 });
    }

    // Supabase's .in() doesn't preserve the given id order — put the
    // results back in the order the admin actually selected them.
    const byId = new Map(orders.map((o) => [o.id, o]));
    const orderedOrders = ids.map((id) => byId.get(id)).filter((o): o is NonNullable<typeof o> => !!o);
    const shipmentIds = orderedOrders
      .map((o) => o.shiprocket_shipment_id)
      .filter((id): id is string => !!id);
    if (shipmentIds.length === 0) {
      return NextResponse.json({ error: "None of the selected orders have a Shiprocket shipment yet" }, { status: 400 });
    }

    const pdfBytes = await buildDuplicatedLabelSheet(shipmentIds);
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="labels-${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Failed to print labels", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not print labels" },
      { status: 500 }
    );
  }
}
