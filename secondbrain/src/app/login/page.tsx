'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebaseAuthContext } from '@/contexts/FirebaseAuthContext';
import Auth from '@/components/Auth';
import Loading from '@/components/Loading';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useFirebaseAuthContext();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleAuthSuccess = async (authenticatedUser: any, selectedPlan?: string) => {
    console.log('Usuario autenticado:', authenticatedUser.uid);
    
    // Si hay un plan seleccionado, verificar si es apropiado redirigir
    if (selectedPlan) {
      console.log('Plan seleccionado desde URL:', selectedPlan);
      
      try {
        // Obtener el perfil del usuario para verificar su plan actual
        const response = await fetch('/api/subscription/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: authenticatedUser.uid })
        });
        
        if (response.ok) {
          const { subscription } = await response.json();
          const currentPlan = subscription?.plan || 'free';
          
          // Solo redirigir si el usuario tiene plan gratuito y selecciona un plan de pago
          const shouldRedirect = (
            (currentPlan === 'free' && ['pro', 'elite'].includes(selectedPlan)) ||
            (currentPlan !== selectedPlan && ['pro', 'elite'].includes(selectedPlan))
          );
          
          if (shouldRedirect) {
            console.log('Redirigiendo a suscripción - plan actual:', currentPlan, '-> plan solicitado:', selectedPlan);
            router.push(`/subscription?plan=${selectedPlan}`);
            return;
          }
        }
      } catch (error) {
        console.error('Error verificando estado de suscripción:', error);
      }
    }
    
    // Redirigir a la app principal después del login
    router.push('/');
  };

  // Si ya está autenticado, redirigir a la app principal
  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return <Loading />;
  }

  if (user) {
    return <Loading />; // Mientras redirige
  }

  return <Auth onAuthSuccess={handleAuthSuccess} />;
}
