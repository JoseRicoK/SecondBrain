import type { Metadata } from "next";
export const SITE_URL = "https://www.lumadiary.com";
export const APP_URL = "https://app.lumadiary.com";
export const SIGNUP_URL = APP_URL + "/signup?plan=free";
export const CONTENT_UPDATED = "2026-09-30";
export function pageMetadata(
  title: string,
  description: string,
  path = "",
): Metadata {
  const url = SITE_URL + path;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "es_ES",
      siteName: "LumaDiary",
      title,
      description,
      url,
      images: [
        {
          url: SITE_URL + "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "LumaDiary, tu diario personal con IA",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SITE_URL + "/twitter-image"],
    },
  };
}
export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
