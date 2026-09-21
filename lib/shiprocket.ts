import { getSetting, setSetting } from "@/lib/settings";

const BASE_URL = "https://apiv2.shiprocket.in/v1/external";

// Every Chapter is a pair of sunglasses in a branded case — uniform enough
// to hardcode a shipping weight/box size rather than collect it per
// product. Adjust here if packaging changes; Shiprocket uses this only for
// courier rate calculation.
const UNIT_WEIGHT_KG = 0.2;
const BOX_DIMENSIONS_CM = { length: 25, breadth: 20, height: 10 };

type TokenCache = { token: string; expiresAt: string };

async function getShiprocketToken(): Promise<string> {
  const cached = await getSetting("SHIPROCKET_TOKEN_CACHE");
  if (cached) {
    const parsed = JSON.parse(cached) as TokenCache;
    if (new Date(parsed.expiresAt) > new Date()) return parsed.token;
  }

  const [email, password] = await Promise.all([
    getSetting("SHIPROCKET_EMAIL"),
    getSetting("SHIPROCKET_PASSWORD"),
  ]);
  if (!email || !password) {
    throw new Error("Shiprocket is not configured yet — add credentials in /admin/settings");
  }

  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Shiprocket login failed: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const token = data.token as string;
  // Tokens are valid ~10 days; refresh a day early to be safe.
  const expiresAt = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString();
  await setSetting("SHIPROCKET_TOKEN_CACHE", JSON.stringify({ token, expiresAt }));

  return token;
}

async function shiprocketFetch(path: string, init: RequestInit = {}) {
  const token = await getShiprocketToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Shiprocket API error (${path}): ${JSON.stringify(data)}`);
  return data;
}

export type ShiprocketOrderInput = {
  orderId: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  paymentMethod: "COD" | "Prepaid";
  subtotal: number;
  total: number;
  items: { name: string; sku: string; quantity: number; price: number }[];
};

/**
 * Creates a shipment on Shiprocket for an order. Splits customer_name into
 * first/last as a best guess (Shiprocket requires both) — fine for the vast
 * majority of names, worth a manual glance in Shiprocket's dashboard for
 * edge cases (single-word names, titles, etc).
 */
export async function createShiprocketOrder(order: ShiprocketOrderInput) {
  const pickupLocation = await getSetting("SHIPROCKET_PICKUP_LOCATION");
  if (!pickupLocation) {
    throw new Error("SHIPROCKET_PICKUP_LOCATION is not set — add it in /admin/settings");
  }

  const [firstName, ...rest] = order.customerName.trim().split(/\s+/);
  const lastName = rest.join(" ") || firstName;
  const totalWeight = Math.max(0.1, order.items.reduce((sum, i) => sum + i.quantity, 0) * UNIT_WEIGHT_KG);

  const data = await shiprocketFetch("/orders/create/adhoc", {
    method: "POST",
    body: JSON.stringify({
      order_id: order.orderId,
      order_date: order.createdAt.slice(0, 16).replace("T", " "),
      pickup_location: pickupLocation,
      billing_customer_name: firstName,
      billing_last_name: lastName,
      billing_address: order.addressLine,
      billing_city: order.city,
      billing_pincode: order.pincode,
      billing_state: order.state,
      billing_country: "India",
      billing_email: order.customerEmail,
      billing_phone: order.customerPhone.replace(/\D/g, "").slice(-10),
      shipping_is_billing: true,
      order_items: order.items.map((item) => ({
        name: item.name,
        sku: item.sku,
        units: item.quantity,
        selling_price: item.price,
      })),
      payment_method: order.paymentMethod,
      sub_total: order.subtotal,
      length: BOX_DIMENSIONS_CM.length,
      breadth: BOX_DIMENSIONS_CM.breadth,
      height: BOX_DIMENSIONS_CM.height,
      weight: totalWeight,
    }),
  });

  return {
    shiprocketOrderId: String(data.order_id),
    shipmentId: String(data.shipment_id),
  };
}

export type ReturnPickupInput = {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  items: { name: string; sku: string; quantity: number; price: number }[];
};

/**
 * Schedules a reverse pickup — a courier collects the item FROM the
 * customer and brings it back to the pickup location on file, for a
 * return/refund. Unlike createShiprocketOrder (confirmed working against
 * a real shipment earlier), this endpoint and payload shape are a
 * best-effort read of Shiprocket's documented "Create Return Order" API,
 * mirrored as closely as possible against the forward-order shape that's
 * already confirmed to work — genuinely untested against a live call.
 * Check the response/Shiprocket's dashboard closely on first real use and
 * adjust field names here if it errors or the pickup doesn't show up
 * correctly on their side.
 */
export async function createShiprocketReturnPickup(input: ReturnPickupInput) {
  const pickupLocation = await getSetting("SHIPROCKET_PICKUP_LOCATION");
  if (!pickupLocation) {
    throw new Error("SHIPROCKET_PICKUP_LOCATION is not set — add it in /admin/settings");
  }

  const [firstName, ...rest] = input.customerName.trim().split(/\s+/);
  const lastName = rest.join(" ") || firstName;
  const totalWeight = Math.max(0.1, input.items.reduce((sum, i) => sum + i.quantity, 0) * UNIT_WEIGHT_KG);

  const data = await shiprocketFetch("/orders/create/return", {
    method: "POST",
    body: JSON.stringify({
      order_id: `RET-${input.orderId}`,
      order_date: new Date().toISOString().slice(0, 16).replace("T", " "),
      pickup_customer_name: firstName,
      pickup_last_name: lastName,
      pickup_address: input.addressLine,
      pickup_city: input.city,
      pickup_state: input.state,
      pickup_country: "India",
      pickup_pincode: input.pincode,
      pickup_email: input.customerEmail,
      pickup_phone: input.customerPhone.replace(/\D/g, "").slice(-10),
      pickup_isd_code: "91",
      shipping_customer_name: pickupLocation,
      pickup_location: pickupLocation,
      order_items: input.items.map((item) => ({
        name: item.name,
        sku: item.sku,
        units: item.quantity,
        selling_price: item.price,
        qc_enable: false,
      })),
      payment_method: "PREPAID",
      sub_total: input.items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      length: BOX_DIMENSIONS_CM.length,
      breadth: BOX_DIMENSIONS_CM.breadth,
      height: BOX_DIMENSIONS_CM.height,
      weight: totalWeight,
    }),
  });

  return {
    shiprocketOrderId: String(data.order_id),
    shipmentId: String(data.shipment_id),
  };
}

export type ShippingRateResult =
  | { status: "not_configured" }
  | { status: "checked_unavailable" }
  | { status: "check_failed" }
  | { status: "available"; rate: number };

/**
 * Live shipping cost for a delivery pincode, straight from Shiprocket's own
 * rate-check API — this is what makes shipping a genuine pass-through
 * rather than a guessed flat fee. Returns the cheapest serviceable courier's
 * rate, rounded up to the rupee.
 *
 * Distinguishes *why* a rate isn't available, because the two cases need
 * opposite handling: "checked_unavailable" (Shiprocket explicitly can't
 * deliver to this pincode) is a real RTO risk and should block the order;
 * "not_configured" or "check_failed" (our setup, or a transient API/network
 * issue) is our problem, not the customer's, and should never block a sale —
 * an occasional free-shipping order is a far smaller cost than turning away
 * a real customer because of our own outage.
 */
export async function getShippingRate(
  deliveryPincode: string,
  unitCount: number
): Promise<ShippingRateResult> {
  const pickupPincode = await getSetting("SHIPROCKET_PICKUP_PINCODE");
  if (!pickupPincode) return { status: "not_configured" };

  const weight = Math.max(0.1, unitCount * UNIT_WEIGHT_KG);

  try {
    const data = await shiprocketFetch(
      `/courier/serviceability/?pickup_postcode=${pickupPincode}&delivery_postcode=${deliveryPincode}&weight=${weight}&cod=0`
    );
    const couriers = data?.data?.available_courier_companies as { rate: number }[] | undefined;
    if (!couriers || couriers.length === 0) return { status: "checked_unavailable" };
    const cheapest = Math.min(...couriers.map((c) => c.rate));
    return { status: "available", rate: Math.ceil(cheapest) };
  } catch (err) {
    console.error("Shiprocket rate check failed", err);
    return { status: "check_failed" };
  }
}

/**
 * Cancels a Shiprocket order — only meaningful pre-pickup. Once a courier
 * has physically picked up the shipment, Shiprocket's own cancel endpoint
 * either no-ops or fails; that case has to be handled as an RTO (refuse at
 * the door) or a post-delivery return instead, not a cancellation.
 */
export async function cancelShiprocketOrder(shiprocketOrderId: string) {
  await shiprocketFetch("/orders/cancel", {
    method: "POST",
    body: JSON.stringify({ ids: [Number(shiprocketOrderId)] }),
  });
}

/**
 * Auto-assigns the best-recommended courier and generates the AWB for a
 * shipment — the step that turns a Shiprocket order sitting in their "New"
 * tab into something with a tracking number, actually ready to be picked
 * up. No courier_id sent, so Shiprocket picks based on its own
 * recommendation (serviceability, rate, performance) rather than us
 * hardcoding a preference.
 */
export async function assignShiprocketAwb(shipmentId: string) {
  const data = await shiprocketFetch("/courier/assign/awb", {
    method: "POST",
    body: JSON.stringify({ shipment_id: Number(shipmentId) }),
  });
  const response = data?.response?.data;
  return {
    awbCode: response?.awb_code ? String(response.awb_code) : null,
    courierName: response?.courier_name ?? null,
  };
}

/**
 * Requests the actual courier pickup, once an AWB exists — without this,
 * an AWB'd shipment can still sit unpicked in "Ready To Ship" indefinitely.
 * Best-effort: a failure here shouldn't undo the AWB assignment, since the
 * order is still shippable and pickup can be requested again manually from
 * Shiprocket's dashboard.
 */
export async function requestShiprocketPickup(shipmentId: string) {
  await shiprocketFetch("/courier/generate/pickup", {
    method: "POST",
    body: JSON.stringify({ shipment_id: [Number(shipmentId)] }),
  });
}

/**
 * Generates the shipping label PDF (barcode, AWB, address) for a shipment
 * that already has an AWB assigned — this is what a warehouse actually
 * packs against. Returns null rather than throwing on failure so it can
 * never block the Ship action itself; the caller decides what to do
 * (currently: skip the warehouse email rather than fail the whole ship).
 */
export async function generateShiprocketLabel(shipmentId: string): Promise<string | null> {
  return generateShiprocketLabelsBatch([shipmentId]);
}

/**
 * Shiprocket's generate/label endpoint is designed to be called ONCE with
 * every shipment_id you want a label for — it returns a single PDF with one
 * page per shipment, in the order given. Calling it once per shipment (the
 * old per-order pattern) still "works" in that it returns 200 with a
 * label_url each time, but Shiprocket can hand back the SAME cached/shared
 * label_url for closely-timed separate calls — which is exactly why a
 * "2 labels per A4" print built by calling this once per order came out as
 * the same label twice. Always batch the ids you actually want together.
 */
export async function generateShiprocketLabelsBatch(shipmentIds: string[]): Promise<string | null> {
  try {
    const data = await shiprocketFetch("/courier/generate/label", {
      method: "POST",
      body: JSON.stringify({ shipment_id: shipmentIds.map(Number) }),
    });
    return data?.label_url ?? null;
  } catch (err) {
    console.error("Shiprocket batch label generation failed", shipmentIds, err);
    return null;
  }
}

export async function trackShiprocketShipment(shipmentId: string) {
  const data = await shiprocketFetch(`/courier/track/shipment/${shipmentId}`);
  const tracking = data[shipmentId]?.tracking_data;
  return {
    status: tracking?.shipment_track?.[0]?.current_status ?? null,
    awbCode: tracking?.shipment_track?.[0]?.awb_code ?? null,
    courierName: tracking?.shipment_track?.[0]?.courier_name ?? null,
  };
}
