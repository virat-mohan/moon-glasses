import type { Metadata } from "next";
import CartClient from "./CartClient";

const SITE_URL = "https://www.moon-glasses.store";

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const resolved = await searchParams;
  const items = typeof resolved?.items === "string" ? resolved.items : "";
  const ogImageUrl = items
    ? `${SITE_URL}/api/og/cart?items=${encodeURIComponent(items)}&v=hd`
    : `${SITE_URL}/api/og/cart?v=hd`;

  return {
    metadataBase: new URL(SITE_URL),
    title: "Your Cart — Moonglasses",
    description: "Complete your Moonglasses order securely with Free Express Delivery across India.",
    openGraph: {
      type: "website",
      siteName: "Moonglasses",
      title: "Your Cart is Ready — Moonglasses",
      description: "Complete your Moonglasses order securely with Free Express Delivery across India.",
      url: `${SITE_URL}/cart${items ? `?items=${encodeURIComponent(items)}` : ""}`,
      images: [
        {
          url: ogImageUrl,
          width: 600,
          height: 600,
          alt: "Moonglasses Cart",
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary",
      title: "Your Cart is Ready — Moonglasses",
      description: "Complete your Moonglasses order securely with Free Express Delivery across India.",
      images: [ogImageUrl],
    },
  };
}

export default function CartPage() {
  return <CartClient />;
}
