import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pre-orders are paused; old "Reserve yours" links go to the collection instead.
  async redirects() {
    return [{ source: "/preorder", destination: "/#shop", permanent: false }];
  },
  images: {
    // Vercel's free-tier Image Optimization quota (1,000 source images/month)
    // has been exhausted, which was breaking every image on the live site
    // with a 402 from the /_next/image endpoint. Serving originals directly
    // unblocks the site immediately at no cost — revisit if a paid plan
    // makes the optimization pipeline worth re-enabling.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Master Inventory's "Import from a supplier's Shopify page" feature
      // stores supplier CDN URLs directly on the draft row rather than
      // re-hosting them — needed for those thumbnails/reference photos to
      // render at all via next/image.
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
