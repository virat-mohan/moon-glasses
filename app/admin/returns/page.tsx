import { getSupabaseServerClient } from "@/lib/supabase";
import { ReturnRequestActions } from "@/components/admin/ReturnRequestActions";

export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default async function AdminReturnsPage() {
  const supabase = getSupabaseServerClient();

  const { data: requests } = await supabase
    .from("return_requests")
    .select(
      "id, order_id, reason, note, photo_url, status, denial_reason, return_shipment_id, refunded_amount, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const orderIds = [...new Set((requests ?? []).map((r) => r.order_id))];
  const { data: orders } = orderIds.length
    ? await supabase.from("orders").select("id, customer_name, customer_phone, customer_email").in("id", orderIds)
    : { data: [] };
  const ordersById = new Map((orders ?? []).map((o) => [o.id, o]));

  return (
    <main className="mx-auto w-full max-w-[1400px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Return Requests</h1>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left">
          <thead>
            <tr className="border-b border-divider text-caption uppercase tracking-[0.05em] text-secondary-text">
              <th className="py-2 pr-4">When</th>
              <th className="py-2 pr-4">Order</th>
              <th className="py-2 pr-4">Customer</th>
              <th className="py-2 pr-4">Reason</th>
              <th className="py-2 pr-4">Note</th>
              <th className="py-2 pr-4">Photo</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Refunded</th>
              <th className="py-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(requests ?? []).map((r) => {
              const order = ordersById.get(r.order_id);
              return (
                <tr key={r.id} className="border-b border-divider align-top">
                  <td className="py-3 text-caption text-secondary-text">{formatDate(r.created_at)}</td>
                  <td className="py-3 text-caption text-secondary-text">#{r.order_id.slice(0, 8).toUpperCase()}</td>
                  <td className="py-3 text-body-s text-ink">
                    {order?.customer_name}
                    <br />
                    <span className="text-caption text-secondary-text">{order?.customer_phone}</span>
                  </td>
                  <td className="py-3 text-body-s text-ink">{r.reason.replace(/_/g, " ")}</td>
                  <td className="py-3 max-w-[220px] text-caption text-secondary-text">{r.note}</td>
                  <td className="py-3">
                    {r.photo_url ? (
                      <a href={r.photo_url} target="_blank" rel="noreferrer" className="text-caption text-ink underline">
                        View
                      </a>
                    ) : (
                      <span className="text-caption text-secondary-text">—</span>
                    )}
                  </td>
                  <td className="py-3 text-caption text-ink">
                    {r.status.replace(/_/g, " ")}
                    {r.status === "denied" && r.denial_reason && (
                      <p className="mt-1 max-w-[160px] text-micro text-secondary-text">{r.denial_reason}</p>
                    )}
                  </td>
                  <td className="py-3 text-caption text-secondary-text">
                    {r.refunded_amount > 0 ? `₹${r.refunded_amount.toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="py-3">
                    {r.status === "requested" ? (
                      <ReturnRequestActions id={r.id} />
                    ) : (
                      <span className="text-micro text-secondary-text">
                        {r.status === "approved" ? "Awaiting pickup" : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {(!requests || requests.length === 0) && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-body-s text-secondary-text">
                  No return requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
