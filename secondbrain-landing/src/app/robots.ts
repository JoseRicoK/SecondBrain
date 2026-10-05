import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      "*",
      "Googlebot",
      "Bingbot",
      "GPTBot",
      "ChatGPT-User",
      "Google-Extended",
      "facebookexternalhit",
      "Twitterbot",
      "LinkedInBot",
      "WhatsApp",
    ].map((userAgent) => ({
      userAgent,
      allow: "/",
      disallow: ["/api/", "/admin/"],
    })),
    sitemap: SITE_URL + "/sitemap.xml",
    host: SITE_URL,
  };
}
