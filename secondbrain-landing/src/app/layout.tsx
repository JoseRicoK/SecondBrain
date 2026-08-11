import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://secondbrainapp.com'),
  title: "SecondBrain - Diario Personal con IA | Tu Segundo Cerebro Digital",
  description: "🧠 El diario personal más avanzado con Inteligencia Artificial. Chat personalizado, grabación de voz, transcripción automática y análisis inteligente. Mejora tu bienestar mental y crecimiento personal con IA. ¡Prueba gratis!",
  keywords: [
    // Palabras clave principales
    "diario personal con IA",
    "diario inteligente", 
    "segundo cerebro digital",
    "chat personal IA",
    
    // Funcionalidades específicas
    "grabación de voz diario",
    "transcripción automática",
    "análisis de sentimientos",
    "estadísticas personales",
    "gestión de personas",
    
    // Beneficios y casos de uso
    "bienestar mental",
    "crecimiento personal", 
    "autoconocimiento",
    "productividad personal",
    "reflexión diaria",
    
    // Tecnología
    "inteligencia artificial",
    "OpenAI GPT",
    "aplicación web",
    "diario digital",
    
    // Long tail keywords
    "como llevar un diario personal",
    "mejor app diario personal",
    "diario personal online gratis",
    "aplicación diario con IA"
  ].join(", "),
  authors: [{ name: "SecondBrain Team", url: "https://secondbrainapp.com" }],
  creator: "SecondBrain",
  publisher: "SecondBrain",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "https://secondbrainapp.com",
    siteName: "SecondBrain - Diario Personal con IA",
    title: "SecondBrain - El Diario Personal más Inteligente del 2025",
    description: "🧠 Revoluciona tu diario personal con IA. Chat inteligente, grabación de voz, transcripción automática y análisis profundo de tu bienestar mental. ¡Comienza gratis hoy!",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "SecondBrain - Diario Personal con Inteligencia Artificial",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@SecondBrainApp",
    creator: "@SecondBrainApp", 
    title: "SecondBrain - Diario Personal con IA | Tu Segundo Cerebro Digital",
    description: "🧠 El diario personal más avanzado con IA. Chat personalizado, grabación de voz y análisis inteligente. ¡Prueba gratis!",
    images: ["/twitter-image"],
  },
  alternates: {
    canonical: "https://secondbrainapp.com",
    languages: {
      'es-ES': 'https://secondbrainapp.com',
    },
  },
  category: "Technology",
  classification: "Productivity, Health & Wellness, AI Tools",
  // Configuración de iconos
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/Logo-simple-SecondBrain.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/Logo-simple-SecondBrain.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'SecondBrain',
    description: 'Diario personal inteligente con IA para crecimiento personal y bienestar mental',
    url: 'https://secondbrainapp.com',
    applicationCategory: 'ProductivityApplication',
    operatingSystem: 'Web, iOS, Android',
    offers: [
      {
        '@type': 'Offer',
        name: 'Plan Gratuito',
        price: '0',
        priceCurrency: 'USD',
        description: 'Acceso básico con funciones esenciales'
      },
      {
        '@type': 'Offer', 
        name: 'Plan Pro',
        price: '9.99',
        priceCurrency: 'USD',
        description: 'Plan profesional con IA avanzada'
      },
      {
        '@type': 'Offer',
        name: 'Plan Elite', 
        price: '19.99',
        priceCurrency: 'USD',
        description: 'Plan premium con todas las funciones'
      }
    ],
    author: {
      '@type': 'Organization',
      name: 'SecondBrain Team',
      url: 'https://secondbrainapp.com'
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '1250',
      bestRating: '5',
      worstRating: '1'
    },
    features: [
      'Chat personal con IA',
      'Grabación y transcripción de voz',
      'Análisis de sentimientos',
      'Estadísticas personales',
      'Gestión inteligente de personas'
    ]
  };

  const orgLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'SecondBrain',
    url: 'https://secondbrainapp.com',
    logo: 'https://secondbrainapp.com/Logo-entero-SecondBrain.png',
    sameAs: [
      'https://x.com/SecondBrainApp'
    ],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'hello@secondbrainapp.com',
        availableLanguage: ['es']
      }
    ]
  };

  return (
    <html lang="es">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }}
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#8b5cf6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SecondBrain" />
        <link rel="apple-touch-icon" href="/Logo-simple-SecondBrain.png" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
