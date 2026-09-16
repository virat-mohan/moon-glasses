import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { calculateDiscount, type DiscountRule } from "@/lib/discounts";
import { getShippingRate } from "@/lib/shiprocket";
import { getCodAdvanceRupees } from "@/lib/order-pricing";
import { findOrCreateCustomerForGuest } from "@/lib/auth";
import { earnMilesForOrder } from "@/lib/loyalty";
import { sendInvoiceEmail, sendOrderNotificationEmail } from "@/lib/email";
import { sendOrderConfirmationWhatsApp } from "@/lib/whatsapp-notify";
import { checkAndAlertLowStock } from "@/lib/inventory";

type ManualOrderItem = { slug: string; quantity: number };

/**
 * For orders that happened outside the normal checkout flow — payment
 * collected directly (a payment link, bank transfer, cash), or recovering
 * an order the checkout flow itself failed to save. Prices are still
 * recomputed from the catalogue (never trust a client-supplied price), the
 * bulk-buy discount still applies automatically, and a manual discount can
 * stack on top for a one-off case the standard rule doesn't cover.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const {
    customerName,
    customerPhone,
    customerEmail,
    address,
    city,
    state,
    pincode,
    items,
    paymentType,
    razorpayPaymentId,
    manualDiscountRupees,
    isGift,
    giftNote,
  }: {
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    items: ManualOrderItem[];
    paymentType: "prepaid" | "cod_advance";
    razorpayPaymentId?: string;
    manualDiscountRupees?: number;
    isGift?: boolean;
    giftNote?: string;
  } = body;

  if (!customerName || !customerPhone || !address || !items?.length) {
    return NextResponse.json({ error: "Missing customer details or items" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const chapters = await getAllChapters();
    const pricedItems = items.map((item) => {
      const chapter = chapters.find((c) => c.slug === item.slug);
      if (!chapter) throw new Error(`Unknown chapter: ${item.slug}`);
      return { slug: item.slug, name: chapter.name, price: chapter.price, quantity: item.quantity };
    });

    const subtotal = pricedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const { data: ruleRow } = await supabase
      .from("discount_rules")
      .select("id, name, buy_quantity, discount_percent")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    const discountRule: DiscountRule | null = ruleRow
      ? { id: ruleRow.id, name: ruleRow.name, buyQuantity: ruleRow.buy_quantity, discountPercent: ruleRow.discount_percent }
      : null;
    const bulkDiscount = calculateDiscount(pricedItems, discountRule);
    const manualDiscount = Math.max(0, Number(manualDiscountRupees) || 0);
    const discountAmount = Math.min(subtotal, bulkDiscount + manualDiscount);

    let shippingCharge = 0;
    if (pincode) {
      const unitCount = pricedItems.reduce((sum, item) => sum + item.quantity, 0);
      const shippingResult = await getShippingRate(pincode, unitCount);
      shippingCharge = shippingResult.status === "available" ? shippingResult.rate : 0;
    }

    const total = Math.max(0, subtotal - discountAmount) + shippingCharge;
    const isCodAdvance = paymentType === "cod_advance";
    const codAdvanceAmount = isCodAdvance ? Math.min(await getCodAdvanceRupees(), total) : 0;
    const balanceDue = isCodAdvance ? total - codAdvanceAmount : 0;

    const customer = await findOrCreateCustomerForGuest(customerPhone, customerEmail || null, customerName);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || "",
        delivery_address: address,
        delivery_city: city || null,
        delivery_state: state || null,
        delivery_pincode: pincode || null,
        subtotal,
        discount_amount: discountAmount,
        shipping_charge: shippingCharge,
        total,
        payment_type: isCodAdvance ? "cod_advance" : "prepaid",
        cod_advance_amount: codAdvanceAmount,
        balance_due: balanceDue,
        is_gift: isGift ?? false,
        gift_note: giftNote || null,
        customer_id: customer?.id ?? null,
        status: "confirmed",
        payment_status: "paid",
        razorpay_payment_id: razorpayPaymentId || null,
      })
      .select()
      .single();
    if (orderError) throw orderError;

    const orderItems = pricedItems.map((item) => ({
      order_id: order.id,
      chapter_slug: item.slug,
      chapter_name: item.name,
      unit_price: item.price,
      quantity: item.quantity,
    }));
    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
    if (itemsError) throw itemsError;

    for (const item of pricedItems) {
      const { data: inv } = await supabase
        .from("inventory")
        .select("stock_on_hand")
        .eq("chapter_slug", item.slug)
        .maybeSingle();
      if (inv) {
        const newStock = Math.max(0, inv.stock_on_hand - item.quantity);
        await supabase.from("inventory").update({ stock_on_hand: newStock }).eq("chapter_slug", item.slug);
        await checkAndAlertLowStock(item.slug, newStock);
      }
    }

    if (customer) {
      const capsBought = pricedItems.reduce((sum, item) => sum + item.quantity, 0);
      await earnMilesForOrder(customer.id, order.id, capsBought);
    }

    await supabase.from("order_events").insert({
      order_id: order.id,
      event_type: "manual_creation",
      detail: manualDiscount > 0 ? `created from admin dashboard, manual discount ₹${manualDiscount}` : "created from admin dashboard",
    });

    await Promise.allSettled([
      sendInvoiceEmail(order, orderItems),
      sendOrderNotificationEmail(order, orderItems),
      sendOrderConfirmationWhatsApp(order, orderItems),
    ]);

    return NextResponse.json({ ok: true, orderId: order.id });
  } catch (err) {
    console.error("Failed to create manual order", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create order" },
      { status: 500 }
    );
  }
}
