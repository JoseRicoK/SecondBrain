import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Precios SecondBrain - Planes de Diario Personal con IA | Desde $0",
  description: "🎯 Descubre los precios de SecondBrain: Plan Gratuito ($0), Plan Pro ($9.99) y Plan Elite ($19.99). Diario personal con IA, chat inteligente, grabación de voz y análisis avanzado. ¡Comienza gratis hoy!",
  keywords: [
    "precios secondbrain",
    "planes diario personal",
    "precio diario con IA",
    "plan gratis diario",
    "suscripción diario inteligente",
    "comparar precios diario personal",
    "costo diario con inteligencia artificial",
    "plan pro diario",
    "plan elite diario",
    "precios app diario",
    "cuanto cuesta diario personal",
    "precio mensual diario IA"
  ].join(", "),
  openGraph: {
    title: "Precios SecondBrain - Planes desde $0 | Diario Personal con IA",
    description: "🎯 Plan Gratuito, Pro ($9.99) y Elite ($19.99). El diario personal más inteligente con IA. ¡Compara planes y elige el mejor para ti!",
    url: "https://secondbrainapp.com/precios",
    images: [
      {
        url: "/Logo-entero-SecondBrain.png",
        width: 1200,
        height: 630,
        alt: "Precios SecondBrain - Planes de Diario Personal con IA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Precios SecondBrain - Desde $0 | Diario Personal con IA",
    description: "🎯 Plan Gratuito, Pro ($9.99) y Elite ($19.99). ¡Compara y elige tu plan ideal!",
  },
  alternates: {
    canonical: "https://secondbrainapp.com/precios",
  },
};

export default function PreciosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pricingJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'SecondBrain - Diario Personal con IA',
    description: 'Diario personal inteligente con IA, chat conversacional, grabación de voz y análisis avanzado',
    brand: {
      '@type': 'Brand',
      name: 'SecondBrain'
    },
    offers: [
      {
        '@type': 'Offer',
        name: 'Plan Gratuito',
        description: 'Perfecto para empezar tu viaje personal. Incluye transcripciones ilimitadas, chat personal básico y navegación por fechas.',
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        validFrom: '2025-01-01',
        priceValidUntil: '2025-12-31',
        url: 'https://app.secondbrainapp.com/signup?plan=free'
      },
      {
        '@type': 'Offer',
        name: 'Plan Pro',
        description: 'Para usuarios serios sobre su crecimiento. Chat avanzado, IA mejorada y estadísticas completas.',
        price: '9.99',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        validFrom: '2025-01-01',
        priceValidUntil: '2025-12-31',
        url: 'https://app.secondbrainapp.com/signup?plan=pro'
      },
      {
        '@type': 'Offer',
        name: 'Plan Elite',
        description: 'Para profesionales que buscan lo mejor. Funciones premium, soporte prioritario y análisis profundo.',
        price: '19.99',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        validFrom: '2025-01-01',
        priceValidUntil: '2025-12-31',
        url: 'https://app.secondbrainapp.com/signup?plan=elite'
      }
    ],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '1250'
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />
      {children}
    </>
  );
}
