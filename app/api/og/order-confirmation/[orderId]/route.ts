import { getSupabaseServerClient } from "@/lib/supabase";
import { renderOrderCardPng } from "@/lib/order-card";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;

  if (orderId === "sample") {
    const png = await renderOrderCardPng(
      { id: "a1b2c3d4-preview", total: 4197 },
      [
        { chapter_name: "Moonglasses Orange", quantity: 1 },
        { chapter_name: "Dunes Maroon", quantity: 1 },
        { chapter_name: "Wildling", quantity: 1 },
      ]
    );
    return new Response(png, { headers: { "Content-Type": "image/png" } });
  }

  const supabase = getSupabaseServerClient();
  const [{ data: order }, { data: items }] = await Promise.all([
    supabase.from("orders").select("id, total").eq("id", orderId).maybeSingle(),
    supabase.from("order_items").select("chapter_name, quantity").eq("order_id", orderId),
  ]);

  if (!order) return new Response("Order not found", { status: 404 });

  const png = await renderOrderCardPng(order, items ?? []);
  return new Response(png, { headers: { "Content-Type": "image/png" } });
}
