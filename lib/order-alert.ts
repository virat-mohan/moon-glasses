/**
 * Pure helpers for the internal "new order" WhatsApp alert to the team
 * (template new_order_alert). No customer name, phone or address ever goes
 * into the variables. Kept import-free so it runs under node --test.
 */
export const ORDER_ALERT_WHATSAPP_DEFAULT = "919999277240";
export const ORDER_ALERT_ADMIN_LINK = "https://www.moon-glasses.store/admin/orders";
export const ORDER_ALERT_TEMPLATE_NAME = "new_order_alert";

export type OrderAlertEvent = "created" | "paid";
export type OrderAlertOrder = { id: string; total: number | string; payment_type?: string | null };

/** Logical name logged in whatsapp_messages.template_name; one per order + event. */
export function orderAlertLogName(event: OrderAlertEvent) {
  return `order_alert_${event}`;
}

export function orderAlertStatusText(paymentType: string | null | undefined, event: OrderAlertEvent) {
  if (paymentType === "post_barter") return "Pay With A Post";
  return event === "paid" ? "UPI paid" : "UPI pending";
}

/** Body variables in template order: short id, item count, total, status, admin link. */
export function buildOrderAlertParams(order: OrderAlertOrder, itemCount: number, event: OrderAlertEvent): string[] {
  return [
    `#${order.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
    String(itemCount),
    Number(order.total).toLocaleString("en-IN"),
    orderAlertStatusText(order.payment_type, event),
    ORDER_ALERT_ADMIN_LINK,
  ];
}

/** True when this order + event has already been alerted (rows from whatsapp_messages). */
export function alreadyAlerted(
  rows: { order_id: string | null; template_name: string | null }[],
  orderId: string,
  event: OrderAlertEvent
) {
  return rows.some((r) => r.order_id === orderId && r.template_name === orderAlertLogName(event));
}

export function normalizeAlertNumber(raw: string | null | undefined) {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits : ORDER_ALERT_WHATSAPP_DEFAULT;
}
