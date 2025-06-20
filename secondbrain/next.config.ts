import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; img-src 'self' data: blob: https://lh3.googleusercontent.com; media-src 'self' data: blob:; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.googleapis.com https://apis.google.com https://js.stripe.com https://*.stripe.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.googleapis.com https://*.firebase.com https://*.firebaseapp.com https://*.cloudfunctions.net wss://*.firebaseio.com https://api.stripe.com https://*.stripe.com; frame-src 'self' https://*.firebaseapp.com https://*.googleapis.com https://accounts.google.com https://js.stripe.com https://checkout.stripe.com https://*.stripe.com; font-src 'self' data:"
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
