import { getSupabaseServerClient } from "@/lib/supabase";

export const SETTINGS_KEYS = [
  "ANTHROPIC_API_KEY",
  "META_ACCESS_TOKEN",
  "META_AD_ACCOUNT_ID",
  "META_PAGE_ID",
  "INSTAGRAM_BUSINESS_ACCOUNT_ID",
  "META_WEBHOOK_VERIFY_TOKEN",
  "META_APP_SECRET",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "BREVO_API_KEY",
  "IMAGE_GEN_API_KEY",
  "OPENAI_API_KEY",
  "META_PIXEL_ID",
  "CRON_SECRET",
  "AGENT_ENABLED",
  "AGENT_MAX_DAILY_BUDGET_RUPEES",
  "MILES_PER_CAP",
  "MILES_REDEMPTION_THRESHOLD",
  "MILES_REDEMPTION_VALUE_RUPEES",
  "MSG91_AUTH_KEY",
  "MSG91_OTP_TEMPLATE_ID",
  "MSG91_ORDER_CONFIRMATION_TEMPLATE_ID",
  "MSG91_ABANDONED_CART_TEMPLATE_ID",
  "MSG91_NDR_TEMPLATE_ID",
  "MSG91_REFERRAL_INVITE_TEMPLATE_ID",
  "SHIPROCKET_EMAIL",
  "SHIPROCKET_PASSWORD",
  "SHIPROCKET_PICKUP_LOCATION",
  "SHIPROCKET_PICKUP_PINCODE",
  "SHIPROCKET_WEBHOOK_TOKEN",
  "COD_ADVANCE_AMOUNT_RUPEES",
  "REFERRAL_DISCOUNT_RUPEES",
  "REFERRAL_REWARD_MILES",
  "WINBACK_AFTER_DAYS",
  "MSG91_WINBACK_TEMPLATE_ID",
  "SHIPROCKET_TOKEN_CACHE",
  "MSG91_RTO_INITIATED_TEMPLATE_ID",
  "MSG91_RTO_REFUNDED_TEMPLATE_ID",
  "RETURN_WINDOW_DAYS",
  "WAREHOUSE_EMAIL",
  "WHATSAPP_SMS_ENABLED",
  "COGS_PER_UNIT_RUPEES",
  "RAZORPAY_WEBHOOK_SECRET",
  "LOW_STOCK_THRESHOLD_UNITS",
  "VIP_MIN_SPEND_RUPEES",
  "DROP_DATE_ISO",
  "PREORDER_AMOUNT_RUPEES",
  "VIP_MIN_ORDERS",
  "MSG91_WHATSAPP_INTEGRATED_NUMBER",
  "MSG91_INBOUND_WEBHOOK_TOKEN",
  "WHATSAPP_PROVIDER",
  "META_WHATSAPP_ACCESS_TOKEN",
  "META_WHATSAPP_PHONE_NUMBER_ID",
  "META_WHATSAPP_TEMPLATE_LANGUAGE",
  "MSG91_WHATSAPP_NAMESPACE",
  "MSG91_WHATSAPP_COST_PER_MESSAGE_RUPEES",
  "MSG91_RESTOCK_TEMPLATE_ID",
  "MSG91_REVIEW_REQUEST_TEMPLATE_ID",
  "MSG91_BUYNOW10_TEMPLATE_ID",
  "MSG91_RETURN_APPROVED_TEMPLATE_ID",
  "MSG91_RETURN_DENIED_TEMPLATE_ID",
  "MSG91_RETURN_REFUNDED_TEMPLATE_ID",
  "MSG91_SHIP_NOTIFICATION_TEMPLATE_ID",
  "WAREHOUSE_WHATSAPP_NUMBERS",
  "MSG91_LEGACY_WINBACK_TEMPLATE_ID",
  "POST_BARTER_MIN_FOLLOWERS",
  "POST_BARTER_REQUIRED_ORDERS",
  "POST_BARTER_FRIEND_DISCOUNT_RUPEES",
  "POST_BARTER_GIFT_FIRST_DAILY_CAP",
  "UPI_ID",
  "UPI_QR_IMAGE_URL",
  "UPI_PAYEE_NAME",
] as const;

export type SettingKey = (typeof SETTINGS_KEYS)[number];

export async function getSetting(key: SettingKey): Promise<string | null> {
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    return data?.value ?? null;
  } catch {
    return null;
  }
}

export async function getAllSettingsMasked(): Promise<Record<SettingKey, boolean>> {
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase.from("app_settings").select("key");
    const present = new Set((data ?? []).map((r) => r.key));
    return Object.fromEntries(SETTINGS_KEYS.map((k) => [k, present.has(k)])) as Record<
      SettingKey,
      boolean
    >;
  } catch {
    return Object.fromEntries(SETTINGS_KEYS.map((k) => [k, false])) as Record<SettingKey, boolean>;
  }
}

export async function setSetting(key: SettingKey, value: string) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}
