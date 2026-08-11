'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSupabaseAuthContext } from '@/contexts/SupabaseAuthContext';
import { useSearchParams } from 'next/navigation';
import { markWelcomeModalSeen } from '@/lib/subscription-operations';
import WelcomeModal from './WelcomeModal';

function WelcomeContent() {
  const { user, userProfile, loading } = useSupabaseAuthContext();
  const searchParams = useSearchParams();
  const [showWelcome, setShowWelcome] = useState(false);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Solo mostrar modal si:
    // 1. No está cargando
    // 2. Hay usuario autenticado
    // 3. Hay perfil de usuario
    // 4. El flag showWelcomeModal está en true (se marca tras primer pago exitoso)
    // 5. Viene de un pago exitoso (hay session_id)
    if (!loading && user && userProfile && userProfile.showWelcomeModal && sessionId) {
      console.log('🎉 [Welcome] Mostrando modal de bienvenida para usuario después del primer pago:', user.displayName || user.email);
      setShowWelcome(true);
    }
  }, [loading, user, userProfile, sessionId]);

  const handleCloseWelcome = async () => {
    setShowWelcome(false);
    
    // Marcar el modal como visto en Supabase
    if (user) {
      try {
        await markWelcomeModalSeen(user.uid);
        console.log('✅ [Welcome] Modal marcado como visto');
      } catch (error) {
        console.error('❌ [Welcome] Error marcando modal como visto:', error);
      }
    }
  };

  if (!showWelcome || !user || !userProfile) {
    return null;
  }

  return (
    <WelcomeModal
      userId={user.uid}
      userName={userProfile.displayName || user.displayName || user.email?.split('@')[0] || 'Usuario'}
      planName={userProfile.subscription.plan}
      onClose={handleCloseWelcome}
    />
  );
}

export default function WelcomeManager() {
  return (
    <Suspense fallback={null}>
      <WelcomeContent />
    </Suspense>
  );
}
