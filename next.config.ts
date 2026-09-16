import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ],
  },
};

export default nextConfig;
