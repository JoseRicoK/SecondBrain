import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PricingSection from "@/components/PricingSection";
import CtaSection from "@/components/CtaSection";
import { getCatalog } from "@/lib/plans";
import { APP_URL, SITE_URL, jsonLd } from "@/lib/site";
export const revalidate = 60;
export default async function PreciosPage() {
  const catalog = await getCatalog();
  const offers = (["free", "pro", "elite"] as const)
    .filter((id) => id === "free" || catalog.checkoutEnabled)
    .map((id) => ({
      "@type": "Offer",
      name: id === "free" ? "Gratuito" : id === "pro" ? "Pro" : "Elite",
      price: id === "free" ? 0 : id === "pro" ? 9.99 : 19.99,
      priceCurrency: "EUR",
      url: APP_URL + "/signup?plan=" + id,
    }));
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />
      <main id="main" className="pt-24">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "SecondBrain",
              url: SITE_URL,
              applicationCategory: "LifestyleApplication",
              operatingSystem: "Web",
              offers,
            }),
          }}
        />
        <PricingSection catalog={catalog} />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
