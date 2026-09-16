import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase";
import { isWithinReturnWindow, getReturnWindowDays } from "@/lib/returns";
import { ReturnRequestForm } from "@/components/returns/ReturnRequestForm";

export const dynamic = "force-dynamic";

export default async function ReturnPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supabase = getSupabaseServerClient();

  const [{ data: order }, { data: existingRequest }, windowDays] = await Promise.all([
    supabase.from("orders").select("id, customer_name, delivered_at").eq("id", orderId).maybeSingle(),
    supabase.from("return_requests").select("id, status").eq("order_id", orderId).maybeSingle(),
    getReturnWindowDays(),
  ]);

  if (!order) notFound();

  const withinWindow = await isWithinReturnWindow(order.delivered_at);

  return (
    <main className="mx-auto w-full max-w-[600px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
      <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
        Order #{order.id.slice(0, 8).toUpperCase()}
      </p>
      <h1 className="mt-2 font-display text-heading-xl uppercase text-ink">Request A Return</h1>

      {existingRequest ? (
        <p className="mt-8 text-body-s text-secondary-text">
          You&apos;ve already submitted a return request for this order — status:{" "}
          <span className="text-ink">{existingRequest.status.replace(/_/g, " ")}</span>. We&apos;ll
          be in touch.
        </p>
      ) : !order.delivered_at ? (
        <p className="mt-8 text-body-s text-secondary-text">
          This order hasn&apos;t been marked delivered yet — returns open once it arrives.
        </p>
      ) : !withinWindow ? (
        <p className="mt-8 text-body-s text-secondary-text">
          The {windowDays}-day return window for this order has closed. If you still have an issue,
          reply to your invoice email and we&apos;ll take a look.
        </p>
      ) : (
        <div className="mt-8">
          <p className="max-w-md text-body-s text-secondary-text">
            Defect/damaged or wrong size, within {windowDays} days of delivery. We&apos;ll review it
            and be in touch about next steps.
          </p>
          <div className="mt-8">
            <ReturnRequestForm orderId={order.id} />
          </div>
        </div>
      )}
    </main>
  );
}
