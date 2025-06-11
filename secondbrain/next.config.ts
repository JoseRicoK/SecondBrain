import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.googleapis.com https://apis.google.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.googleapis.com https://*.firebase.com https://*.firebaseapp.com https://*.cloudfunctions.net wss://*.firebaseio.com"
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
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
