import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { pageMetadata, SITE_URL, jsonLd } from "@/lib/site";
import "./globals.css";
import "./landing-visual.css";
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
export const metadata: Metadata = {
  ...pageMetadata(
    "Diario personal con IA y voz | SecondBrain",
    "Escribe o graba tu diario, conversa sobre tus experiencias y vuelve a lo importante. Empieza gratis con SecondBrain, sin tarjeta y desde tu navegador.",
  ),
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Diario personal con IA y voz | SecondBrain",
    template: "%s | SecondBrain",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: { icon: "/favicon.ico", apple: "/Logo-simple-SecondBrain.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};
const graph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": SITE_URL + "/#organization",
      name: "SecondBrain",
      url: SITE_URL,
      logo: SITE_URL + "/Logo-simple-SecondBrain.png",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "hello@secondbrainapp.com",
        availableLanguage: "es",
      },
    },
    {
      "@type": "WebSite",
      "@id": SITE_URL + "/#website",
      name: "SecondBrain",
      url: SITE_URL,
      inLanguage: "es",
      publisher: { "@id": SITE_URL + "/#organization" },
    },
  ],
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(graph) }}
        />
      </head>
      <body
        className={
          inter.variable + " font-sans antialiased bg-slate-900 text-slate-100"
        }
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[2000] focus:rounded focus:bg-white focus:p-3 focus:text-slate-900"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
