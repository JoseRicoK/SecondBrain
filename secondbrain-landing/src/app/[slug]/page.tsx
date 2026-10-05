import { notFound } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CtaSection from "@/components/CtaSection";
import { guides } from "@/lib/content";
import { pageMetadata, SITE_URL, CONTENT_UPDATED, jsonLd } from "@/lib/site";
export const dynamicParams = true;
export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }));
}
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const guide = guides.find((g) => g.slug === slug);
  return guide ? pageMetadata(guide.title, guide.description, "/" + slug) : {};
}
export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = guides.find((g) => g.slug === slug);
  if (!guide) notFound();
  const url = SITE_URL + "/" + slug;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: guide.title,
        description: guide.description,
        dateModified: CONTENT_UPDATED,
        author: { "@type": "Organization", name: "SecondBrain" },
        publisher: { "@id": SITE_URL + "/#organization" },
        mainEntityOfPage: url,
        inLanguage: "es",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: guide.title, item: url },
        ],
      },
    ],
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900">
      <Header />
      <main id="main" className="mx-auto max-w-3xl px-6 pb-12 pt-32">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}
        />
        <nav aria-label="Migas de pan" className="text-sm text-slate-300">
          <Link href="/" className="underline">
            Inicio
          </Link>{" "}
          / Guías
        </nav>
        <p className="mt-8 text-sm text-purple-300">
          Guía de SecondBrain · Actualizada el 30 de septiembre de 2026
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-white sm:text-5xl">
          {guide.title}
        </h1>
        <p className="mt-7 text-xl leading-relaxed text-slate-300">
          {guide.intro}
        </p>
        <nav
          aria-label="En esta guía"
          className="mt-9 rounded-xl border border-white/10 p-6"
        >
          <p className="mb-3 font-semibold text-white">En esta guía</p>
          <ul className="space-y-2">
            {guide.sections.map((section, i) => (
              <li key={section.title}>
                <a className="text-purple-300 underline" href={"#seccion-" + i}>
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <article className="mt-10 space-y-12">
          {guide.sections.map((section, i) => (
            <section
              className="scroll-mt-24"
              id={"seccion-" + i}
              key={section.title}
            >
              <h2 className="text-2xl font-semibold text-white">
                {section.title}
              </h2>
              {section.paragraphs.map((p) => (
                <p key={p} className="mt-4 leading-8 text-slate-300">
                  {p}
                </p>
              ))}
            </section>
          ))}
          <section className="rounded-2xl border border-purple-400/30 bg-purple-500/10 p-6">
            <h2 className="text-xl font-semibold text-white">
              Una pregunta para tu primera entrada
            </h2>
            <p className="mt-4 text-lg text-purple-100">{guide.prompt}</p>
          </section>
        </article>
        <aside className="mt-12 border-t border-white/10 pt-8">
          <h2 className="text-xl font-semibold text-white">Sigue explorando</h2>
          <ul className="mt-4 space-y-3">
            {guides
              .filter((g) => g.slug !== slug)
              .map((g) => (
                <li key={g.slug}>
                  <Link
                    href={"/" + g.slug}
                    className="text-purple-300 underline"
                  >
                    {g.title}
                  </Link>
                </li>
              ))}
          </ul>
          <p className="mt-5 text-slate-300">
            Antes de empezar, consulta{" "}
            <Link className="text-purple-300 underline" href="/precios">
              los planes
            </Link>{" "}
            y{" "}
            <Link className="text-purple-300 underline" href="/privacidad">
              cómo se procesan tus datos
            </Link>
            .
          </p>
        </aside>
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
