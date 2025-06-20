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
  const handleAuthSuccess = async (authenticatedUser: any, selectedPlan?: string) => {
    console.log('Usuario autenticado en signup:', authenticatedUser.uid);
    
    // En signup, normalmente queremos redirigir al plan seleccionado
    // pero primero verificamos si ya tiene un plan de pago activo
    const planToUse = selectedPlan || plan;
    
    if (planToUse) {
      try {
        // Verificar el plan actual del usuario
        const response = await fetch('/api/subscription/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: authenticatedUser.uid })
        });
        
        if (response.ok) {
          const { subscription } = await response.json();
          const currentPlan = subscription?.plan || 'free';
          
          // Solo redirigir a suscripción si:
          // 1. El plan solicitado es de pago (pro/elite) Y
          // 2. El usuario no tiene ya ese plan
          if (['pro', 'elite'].includes(planToUse) && currentPlan !== planToUse) {
            console.log('Nuevo usuario o upgrade - redirigiendo a suscripción:', planToUse);
            router.push(`/subscription?plan=${planToUse}`);
            return;
          } else if (planToUse === 'free' || currentPlan === planToUse) {
            console.log('Usuario ya tiene el plan adecuado, ir a app principal');
            router.push('/');
            return;
          }
        }
      } catch (error) {
        console.error('Error verificando estado de suscripción:', error);
        // En caso de error en signup, ser conservador y redirigir al plan
        if (['pro', 'elite'].includes(planToUse)) {
          router.push(`/subscription?plan=${planToUse}`);
          return;
        }
      }
    }
    
    // Si no hay plan específico, ir a la app principal
    router.push('/');
  };

  // Si ya está autenticado, redirigir según corresponda
  useEffect(() => {
    if (!loading && user) {
      // Usuario ya autenticado - verificar si necesita ir a suscripción
      if (plan && ['pro', 'elite'].includes(plan)) {
        // Solo redirigir a suscripción si es un plan de pago
        // El usuario podría ya tener ese plan o uno superior
        router.push(`/subscription?plan=${plan}`);
      } else {
        // Si no hay plan específico de pago, ir a la app principal
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
