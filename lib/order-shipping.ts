import { getSupabaseServerClient } from "@/lib/supabase";
import {
  createShiprocketOrder,
  assignShiprocketAwb,
  requestShiprocketPickup,
  generateShiprocketLabel,
} from "@/lib/shiprocket";
import { sendWarehouseNotificationEmail } from "@/lib/email";
import { buildAndUploadDuplicatedLabel } from "@/lib/label-print";
import { sendShipNotificationWhatsApp } from "@/lib/whatsapp-notify";

/**
 * Creates the Shiprocket shipment for an order — courier assignment, pickup
 * request, label generation, and the warehouse invoice+label email, all in
 * one place. Shared by the manual "Ship" button in /admin/orders and
 * finalizeOrder's automatic call right after checkout, so both paths behave
 * identically and can never drift apart.
 *
 * Only the initial Shiprocket-order creation is fatal (throws) — everything
 * after that (AWB assignment, pickup, label, warehouse email) is
 * best-effort, same as the original admin-only route: a courier or label
 * hiccup must never look like shipping the order failed outright, since the
 * order is already safely created in Shiprocket by that point and any of
 * these steps can be retried from Shiprocket's own dashboard.
 */
export async function shipOrder(orderId: string) {
  const supabase = getSupabaseServerClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) throw new Error("Order not found");
  if (order.shiprocket_shipment_id) throw new Error("This order already has a shipment");
  if (!order.delivery_city || !order.delivery_state || !order.delivery_pincode) {
    throw new Error("Order is missing city/state/pincode — this order predates structured addresses");
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("chapter_slug, chapter_name, unit_price, quantity")
    .eq("order_id", orderId);

  const { shiprocketOrderId, shipmentId } = await createShiprocketOrder({
    orderId: order.id,
    createdAt: order.created_at,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    customerEmail: order.customer_email,
    addressLine: order.delivery_address,
    city: order.delivery_city,
    state: order.delivery_state,
    pincode: order.delivery_pincode,
    paymentMethod: order.payment_type === "cod_advance" ? "COD" : "Prepaid",
    // For a COD-advance order, Shiprocket should only show the remaining
    // balance as collectible on delivery — the advance was already charged
    // online. Field mapping here is a best-effort read of Shiprocket's API
    // (sub_total drives the COD collectible amount); worth confirming
    // against what actually shows in Shiprocket's dashboard.
    subtotal: order.payment_type === "cod_advance" ? order.balance_due : order.subtotal,
    total: order.total,
    items: (items ?? []).map((item) => ({
      name: item.chapter_name,
      sku: item.chapter_slug,
      quantity: item.quantity,
      price: item.unit_price,
    })),
  });

  const { error } = await supabase
    .from("orders")
    .update({
      shiprocket_order_id: shiprocketOrderId,
      shiprocket_shipment_id: shipmentId,
      shipment_status: "processing",
    })
    .eq("id", orderId);
  if (error) throw error;

  let awbCode: string | null = null;
  let courierName: string | null = null;
  let courierWarning: string | null = null;
  try {
    const assigned = await assignShiprocketAwb(shipmentId);
    awbCode = assigned.awbCode;
    courierName = assigned.courierName;
    if (awbCode) {
      // Explicit local status between "order created" and whatever Shiprocket's
      // own tracking API eventually reports — that tracking data is empty
      // until the courier actually scans the parcel, so without these two
      // writes the order would just say "processing" the entire time between
      // creation and real pickup, even once a courier is assigned and
      // waiting on collection.
      await supabase
        .from("orders")
        .update({ shiprocket_awb_code: awbCode, courier_name: courierName, shipment_status: "ready_to_ship" })
        .eq("id", orderId);
      try {
        await requestShiprocketPickup(shipmentId);
        await supabase.from("orders").update({ shipment_status: "pickup_pending" }).eq("id", orderId);
      } catch (pickupErr) {
        console.error("Shiprocket pickup request failed", orderId, pickupErr);
        courierWarning = "Courier assigned, but the pickup request failed — schedule it from Shiprocket's dashboard.";
      }

      try {
        const labelUrl = await generateShiprocketLabel(shipmentId);
        if (labelUrl) {
          await supabase.from("orders").update({ shiprocket_label_url: labelUrl }).eq("id", orderId);
        }
        // The warehouse email gets a "2 copies on one A4" version, not the
        // raw single label — one copy for the parcel, one to keep, printed
        // together on the same sheet. Falls back to the plain single label
        // if the duplicate-sheet build fails for any reason, so the email
        // still goes out with something printable.
        const duplicatedLabelUrl = await buildAndUploadDuplicatedLabel(shipmentId, orderId);
        await sendWarehouseNotificationEmail(
          { ...order, shiprocket_awb_code: awbCode, courier_name: courierName },
          items ?? [],
          duplicatedLabelUrl ?? labelUrl
        );

        // Same duplicated label, sent as a WhatsApp document to the
        // warehouse team's own numbers alongside the email — best-effort,
        // and only fires if there's an actual label to attach (a document-
        // header template needs a real file).
        if (duplicatedLabelUrl ?? labelUrl) {
          const itemsLine = (items ?? []).map((item) => `${item.quantity}x ${item.chapter_name}`).join(", ");
          await sendShipNotificationWhatsApp(
            orderId,
            order.customer_name,
            order.customer_phone,
            itemsLine,
            order.total,
            (duplicatedLabelUrl ?? labelUrl) as string
          );
        }
      } catch (notifyErr) {
        console.error("Warehouse notification failed", orderId, notifyErr);
      }
    } else {
      courierWarning = "Order created, but no courier could be auto-assigned — assign one from Shiprocket's dashboard.";
    }
  } catch (awbErr) {
    console.error("Shiprocket AWB assignment failed", orderId, awbErr);
    courierWarning = "Order created in Shiprocket, but courier assignment failed — assign one from Shiprocket's dashboard.";
  }

  return { shiprocketOrderId, shipmentId, awbCode, courierName, courierWarning };
}
