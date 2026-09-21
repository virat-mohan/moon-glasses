import type { Metadata } from "next";
import { Space_Grotesk, Inter, Bodoni_Moda } from "next/font/google";
import { Navbar } from "@/components/navigation/Navbar";
import { ScrollToTop } from "@/components/navigation/ScrollToTop";
import { MetaPixelTracker } from "@/components/tracking/MetaPixel";
import { WhatsAppFloatButton } from "@/components/contact/WhatsAppFloatButton";
import { AmbientTechno } from "@/components/audio/AmbientTechno";
import { StickyCountdownBar } from "@/components/countdown/StickyCountdownBar";
import { CartProvider } from "@/lib/cart";
import { getSetting } from "@/lib/settings";
import { getDropDateIso } from "@/lib/dropDate";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// Reserved exclusively for the "Pay With A Post" wordmark (PayWithAPostMark)
// — a high-contrast editorial serif, deliberately distinct from the site's
// sans-serif display/body faces, so the trademarked term reads as its own
// named feature rather than emphasized body copy.
const bodoniModa = Bodoni_Moda({
  variable: "--font-bodoni-moda",
  subsets: ["latin"],
  weight: ["700", "800"],
  style: ["italic"],
});

const SITE_URL = "https://moon-glasses.store";
const DESCRIPTION =
  "MOON GLASSES™ — fashion eyewear for after dark. ₹1,499 acetate, ₹1,999 metal. Ships across India.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MOON GLASSES™ — See A Brighter You",
    template: "%s — MOON GLASSES™",
  },
  description: DESCRIPTION,
  keywords: ["fashion sunglasses India", "MOON GLASSES", "eyewear", "aviator sunglasses"],
  openGraph: {
    type: "website",
    siteName: "MOON GLASSES",
    title: "MOON GLASSES™ — See A Brighter You",
    description: DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/images/brand/moon-glasses-logo.png", width: 1200, height: 630, alt: "MOON GLASSES" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MOON GLASSES™ — See A Brighter You",
    description: DESCRIPTION,
    images: ["/images/brand/moon-glasses-logo.png"],
  },
  alternates: { canonical: SITE_URL },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "MOON GLASSES",
  url: SITE_URL,
  logo: `${SITE_URL}/images/brand/moon-glasses-logo.png`,
  description: DESCRIPTION,
  address: { "@type": "PostalAddress", addressCountry: "IN" },
  sameAs: ["https://www.instagram.com/moonglassesonline/"],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const pixelId = await getSetting("META_PIXEL_ID");
  const dropDateIso = await getDropDateIso();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${bodoniModa.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <MetaPixelTracker pixelId={pixelId} />
        <CartProvider>
          <ScrollToTop />
          <div>
            <StickyCountdownBar targetIso={dropDateIso} />
            <Navbar />
          </div>
          {children}
          <WhatsAppFloatButton />
          <AmbientTechno />
        </CartProvider>
        <Analytics />
      </body>
    </html>
  );
}
