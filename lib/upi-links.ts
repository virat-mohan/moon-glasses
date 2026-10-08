/**
 * UPI app buttons for paying on the same phone. One pay link (exact amount,
 * with the paise tag the bank-SMS matcher relies on) re-targeted at each app.
 * Android uses intent URLs; iOS uses each app's scheme.
 */
export type UpiDevice = "android" | "ios" | "desktop";

export function buildUpiLink(input: { upiId: string; payeeName: string; amountPaise: number; orderId: string }) {
  const amount = (input.amountPaise / 100).toFixed(2);
  const payee = !input.payeeName || input.payeeName === "Moonglasses" ? "Virat Mohan" : input.payeeName;
  return (
    `upi://pay?pa=${input.upiId}&pn=${encodeURIComponent(payee)}` +
    `&am=${amount}&cu=INR&tn=${encodeURIComponent(`Order ${input.orderId.slice(0, 8).toUpperCase()}`)}`
  );
}

/** Google Pay + generic chooser (the existing confirmed page set). */
export function upiAppLinks(upiLink: string, device: UpiDevice) {
  const query = upiLink.split("?")[1] ?? "";
  const gpay =
    device === "android"
      ? `intent://pay?${query}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`
      : `gpay://upi/pay?${query}`;
  return [
    { name: "Google Pay", href: gpay, primary: true },
    { name: "Other UPI app", href: upiLink, primary: true },
  ];
}

/** The pay page's full button set. */
export function upiPayButtons(upiLink: string, device: UpiDevice) {
  const query = upiLink.split("?")[1] ?? "";
  const [gpay, other] = upiAppLinks(upiLink, device);
  const phonepe = device === "android" ? `intent://pay?${query}#Intent;scheme=upi;package=com.phonepe.app;end` : `phonepe://pay?${query}`;
  const paytm = device === "android" ? `intent://pay?${query}#Intent;scheme=upi;package=net.one97.paytm;end` : `paytmmp://pay?${query}`;
  return [
    { name: "Google Pay", href: gpay.href },
    { name: "PhonePe", href: phonepe },
    { name: "Paytm", href: paytm },
    { name: "Other UPI app", href: other.href },
  ];
}
