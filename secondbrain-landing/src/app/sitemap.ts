import type { MetadataRoute } from "next";
import { SITE_URL, CONTENT_UPDATED } from "@/lib/site";
import { guides } from "@/lib/content";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "",
    "/precios",
    ...guides.map((g) => "/" + g.slug),
    "/privacidad",
    "/terminos",
    "/soporte",
  ].map((path) => ({
    url: SITE_URL + path,
    lastModified: CONTENT_UPDATED,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority:
      path === ""
        ? 1
        : path === "/precios"
          ? 0.9
          : path === "/soporte" ||
              path === "/privacidad" ||
              path === "/terminos"
            ? 0.3
            : 0.8,
  }));
}
