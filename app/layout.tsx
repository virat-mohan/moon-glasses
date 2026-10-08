import type { Metadata } from "next";
import { Space_Grotesk, Inter, Bodoni_Moda } from "next/font/google";
import { Navbar } from "@/components/navigation/Navbar";
import { ScrollToTop } from "@/components/navigation/ScrollToTop";
import { MetaPixelTracker } from "@/components/tracking/MetaPixel";
import { GoogleAnalytics } from "@/components/tracking/GoogleAnalytics";
import { MicrosoftClarity } from "@/components/tracking/MicrosoftClarity";
import { WhatsAppFloatButton } from "@/components/contact/WhatsAppFloatButton";
import { SupportNumberProvider } from "@/components/help/SupportNumberProvider";
import { setRuntimeSupportNumber } from "@/lib/whatsapp-help";
import { AmbientTechno } from "@/components/audio/AmbientTechno";
import { CartProvider } from "@/lib/cart";
import { getSetting } from "@/lib/settings";
import { isLaunchSoon } from "@/lib/launch";
import { LaunchSoonProvider } from "@/components/launch/LaunchContext";
import { LaunchingSoonBar } from "@/components/launch/LaunchingSoonBar";
import { brand, titleBrandName } from "@/lib/retail-os-brand";
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

// Brand identity is now sourced from the canonical Retail OS brand config
// (lib/retail-os-brand.ts). Values are unchanged — this only removes the
// hardcoded duplication (including the second SITE_URL that had to be kept in
// sync by hand) so Moon is configured, not hand-edited.
const SITE_URL = brand.profile.siteUrl;
const DESCRIPTION = brand.description;
const DEFAULT_TITLE = `${titleBrandName()} — ${brand.profile.tagline}`;
const OG_IMAGE = brand.assets.ogImagePath;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s — ${titleBrandName()}`,
  },
  description: DESCRIPTION,
  keywords: brand.keywords,
  openGraph: {
    type: "website",
    siteName: brand.profile.brandName,
    title: DEFAULT_TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: brand.profile.brandName }],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  alternates: { canonical: SITE_URL },
  verification: {
    google: "google393d29dd633d2458",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: brand.profile.brandName,
  url: SITE_URL,
  logo: `${SITE_URL}${brand.assets.orgLogoPath}`,
  description: DESCRIPTION,
  address: { "@type": "PostalAddress", addressCountry: brand.address?.addressCountry ?? "IN" },
  sameAs: brand.social?.instagram ? [brand.social.instagram] : [],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [pixelId, launchSoon, supportWhatsapp, gaId, clarityId] = await Promise.all([
    getSetting("META_PIXEL_ID"),
    isLaunchSoon(),
    getSetting("SUPPORT_WHATSAPP"),
    getSetting("GA4_MEASUREMENT_ID"),
    getSetting("CLARITY_PROJECT_ID"),
  ]);
  setRuntimeSupportNumber(supportWhatsapp);

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
        <GoogleAnalytics measurementId={gaId || "G-J050RRX35Q"} />
        <MicrosoftClarity projectId={clarityId || "yuinfh4imy"} />
        <SupportNumberProvider number={supportWhatsapp}>
        <LaunchSoonProvider soon={launchSoon}>
          <CartProvider>
            <ScrollToTop />
            <div>
              {launchSoon && <LaunchingSoonBar />}
              <Navbar />
            </div>
            {children}
            <WhatsAppFloatButton number={supportWhatsapp} />
            <AmbientTechno />
          </CartProvider>
        </LaunchSoonProvider>
        </SupportNumberProvider>
        <Analytics />
      </body>
    </html>
  );
}
