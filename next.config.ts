import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Profile photos are served from /api/photos or from an external CDN configured here.
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
};

export default nextConfig;
