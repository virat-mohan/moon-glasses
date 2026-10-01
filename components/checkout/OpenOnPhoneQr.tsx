"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Laptop only: most people post to Instagram from their phone, so show a QR
 * of this exact page. Scanning it opens the same page on the phone, where
 * "Share to Instagram" hands the image straight to the Instagram app.
 */
export function OpenOnPhoneQr() {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (/android|iphone|ipad|ipod/i.test(navigator.userAgent)) return;
    QRCode.toDataURL(window.location.href, { width: 320, margin: 1 })
      .then(setQr)
      .catch(() => {});
  }, []);
  if (!qr) return null;
  return (
    <div className="mt-6 flex items-center gap-4 border border-divider p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="Open this page on your phone" width={120} height={120} className="flex-none bg-white p-1.5" />
      <div>
        <p className="text-body-s font-bold text-ink">Post from your phone</p>
        <p className="mt-1 text-caption text-secondary-text">
          Scan with your phone camera to open this page there, then tap Share to Instagram. The image goes straight into
          the Instagram app.
        </p>
      </div>
    </div>
  );
}
