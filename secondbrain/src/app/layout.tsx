import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthWrapper } from "@/components/AuthWrapper";
import WelcomeManager from "@/components/WelcomeManager";
import ChunkErrorHandler from "@/components/ChunkErrorHandler";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap',
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover' // Importante para Safari iOS con safe areas
};

export const metadata: Metadata = {
  title: "LumaDiary",
  description: "Tu diario personal con IA",
  icons: {
    icon: [
      {
        url: '/brand/icon-32.png',
        type: 'image/png',
        sizes: '32x32',
      },
      {
        url: '/brand/icon-16.png',
        type: 'image/png',
        sizes: '16x16',
      }
    ],
    apple: {
      url: '/brand/icon-180.png',
      sizes: '180x180',
      type: 'image/png',
    },
    shortcut: '/brand/icon-32.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
      >
        <ChunkErrorHandler />
        <AuthWrapper>
          {children}
          <WelcomeManager />
        </AuthWrapper>
      </body>
    </html>
  );
}
