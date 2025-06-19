'use client';

import React, { Suspense } from 'react';
import { FirebaseAuthProvider } from '@/contexts/FirebaseAuthContext';

interface AuthWrapperProps {
  children: React.ReactNode;
}

// Error boundary para capturar errores de carga de chunks
class ChunkErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    // Detectar errores específicos de chunk loading
    if (error?.name === 'ChunkLoadError' || 
        error?.message?.includes('Loading chunk') ||
        error?.message?.includes('chunk') ||
        error?.stack?.includes('webpack')) {
      console.error('🔄 [ChunkError] Error de carga detectado, recargando...', error);
      // Recargar la página cuando hay errores de chunk
      setTimeout(() => window.location.reload(), 100);
      return { hasError: true };
    }
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('🚨 [ErrorBoundary] Error capturado:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Cargando aplicación...</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading fallback
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-2 text-gray-600">Cargando SecondBrain...</p>
    </div>
  </div>
);

export function AuthWrapper({ children }: AuthWrapperProps) {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <FirebaseAuthProvider>
          {children}
        </FirebaseAuthProvider>
      </Suspense>
    </ChunkErrorBoundary>
  );
}
