import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "SecondBrain - Tu Diario Personal Inteligente",
  description: "El diario personal más avanzado con IA. Chat personalizado, grabación de voz, transcripción automática y gestión inteligente de personas. Tu segundo cerebro digital.",
  keywords: "diario personal, IA, inteligencia artificial, chat personal, grabación de voz, transcripción, segundo cerebro, OpenAI, diario digital",
  authors: [{ name: "SecondBrain Team" }],
  openGraph: {
    title: "SecondBrain - Tu Diario Personal Inteligente",
    description: "El diario personal más avanzado con IA. Chat personalizado, grabación de voz y transcripción automática.",
    url: "https://secondbrain.com", 
    siteName: "SecondBrain",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SecondBrain - Tu Diario Personal Inteligente",
    description: "El diario personal más avanzado con IA. Chat personalizado, grabación de voz y transcripción automática.",
  },
  robots: {
    index: true,
    follow: true,
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
  return (
    <html lang="es">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
