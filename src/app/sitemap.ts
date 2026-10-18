import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";


export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/signup`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/login`, changeFrequency: "monthly", priority: 0.3 },
    ...["terms", "privacy", "cancellation", "safety", "accessibility"].map((p) => ({ url: `${SITE_URL}/${p}`, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
