import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://mela-production-e3fb.up.railway.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/signup", "/login"], disallow: ["/admin", "/api", "/discover", "/picks", "/matches", "/profile", "/onboarding"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
