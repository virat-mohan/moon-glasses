"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { trackEvent, captureAttribution, captureReferral, captureUtmSource } from "@/lib/client-tracking";

export function MetaPixelTracker({ pixelId }: { pixelId: string | null }) {
  const pathname = usePathname();

  useEffect(() => {
    captureAttribution();
    captureReferral();
    captureUtmSource();
    trackEvent("PageView");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!pixelId) return null;

  return (
    <>
      <Script id="meta-pixel-base" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
        n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
        document,'script','https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${pixelId}');
        fbq('track', 'PageView');`}
      </Script>
      {/* Fallback for visitors with JavaScript disabled — mirrors the base PageView event. */}
      <noscript>
        <img
          height="1"
          width="1"
          alt=""
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
