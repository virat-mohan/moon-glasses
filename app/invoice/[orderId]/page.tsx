import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase";
import { renderInvoiceHtml } from "@/lib/invoice";

export const dynamic = "force-dynamic";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const supabase = getSupabaseServerClient();

  const [{ data: order }, { data: items }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
    supabase.from("order_items").select("chapter_name, unit_price, quantity").eq("order_id", orderId),
  ]);

  if (!order) notFound();

  const html = await renderInvoiceHtml(order, items ?? []);

  return (
    <main className="mx-auto w-full max-w-[700px] px-6 py-16">
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
