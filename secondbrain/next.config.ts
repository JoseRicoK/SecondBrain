import type { NextConfig } from "next";

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
  // Deshabilitar TODAS las optimizaciones problemáticas
  swcMinify: false,
  experimental: {
    esmExternals: false,
  },
  // Configuración webpack para deshabilitar chunk splitting problemático
  webpack: (config, { dev, isServer }) => {
    console.log('🔧 [Webpack] Configurando webpack...');
    
    // Deshabilitar source maps completamente
    config.devtool = false;
    
    // Deshabilitar chunk splitting en desarrollo
    if (dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Un solo chunk para todo
            bundle: {
              name: 'bundle',
              chunks: 'all',
              enforce: true,
            },
          },
        },
      };
    }
    
    // Configurar resolución de módulos
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      url: false,
      zlib: false,
      http: false,
      https: false,
      assert: false,
      os: false,
      path: false,
    };
    
    console.log('✅ [Webpack] Configuración aplicada');
    return config;
  },
  // Headers de seguridad simplificados
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default nextConfig;
