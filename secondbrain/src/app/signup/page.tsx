'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFirebaseAuthContext } from '@/contexts/FirebaseAuthContext';
import Auth from '@/components/Auth';
import Loading from '@/components/Loading';

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useFirebaseAuthContext();
  const plan = searchParams.get('plan');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleAuthSuccess = (authenticatedUser: any, selectedPlan?: string) => {
    console.log('Usuario autenticado:', authenticatedUser.uid);
    
    // Si hay un plan seleccionado (del parámetro URL o del auth), redirigir a suscripción
    const planToUse = selectedPlan || plan;
    if (planToUse) {
      console.log('Plan seleccionado:', planToUse);
      router.push(`/subscription?plan=${planToUse}`);
    } else {
      // Si no hay plan, ir a la app principal
      router.push('/');
    }
  };

  // Si ya está autenticado, redirigir según corresponda
  useEffect(() => {
    if (!loading && user) {
      if (plan) {
        router.push(`/subscription?plan=${plan}`);
      } else {
        router.push('/');
      }
    }
  }, [user, loading, plan, router]);

  if (loading) {
    return <Loading />;
  }

  if (user) {
    return <Loading />; // Mientras redirige
  }

  return <Auth onAuthSuccess={handleAuthSuccess} />;
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando...</p>
      </div>
    </div>}>
      <SignupContent />
    </Suspense>
  );
}
