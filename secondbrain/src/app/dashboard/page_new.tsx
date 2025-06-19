'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFirebaseAuthContext } from '@/contexts/FirebaseAuthContext';
import { FaCheckCircle, FaSpinner, FaHome } from 'react-icons/fa';

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile, loading } = useFirebaseAuthContext();
  const [paymentStatus, setPaymentStatus] = useState<'checking' | 'success' | 'error' | 'none'>('none');
  const [message, setMessage] = useState('');

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Redirigir si no está autenticado
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    // Si hay session_id, verificar el estado del pago
    if (sessionId && user) {
      setPaymentStatus('checking');
      setMessage('Verificando el estado de tu suscripción...');
      
      // Esperar un poco para que el webhook procese el pago
      setTimeout(async () => {
        try {
          const response = await fetch(`/api/subscription/status?userId=${user.uid}`);
          const data = await response.json();
          
          if (response.ok) {
            setPaymentStatus('success');
            setMessage('¡Pago exitoso! Tu suscripción está activa.');
            
            // Redirigir a la página principal después de 3 segundos
            setTimeout(() => {
              router.push('/');
            }, 3000);
          } else {
            throw new Error(data.error || 'Error verificando suscripción');
          }
        } catch (error) {
          console.error('Error verificando pago:', error);
          setPaymentStatus('error');
          setMessage('Hubo un error verificando tu pago. Por favor contacta soporte.');
        }
      }, 2000);
    } else if (!loading && user && !sessionId) {
      // Si no hay session_id, redirigir a la página principal
      router.push('/');
    }
  }, [sessionId, user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md w-full text-center">
        {paymentStatus === 'checking' && (
          <>
            <FaSpinner className="w-16 h-16 text-purple-600 animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Procesando pago
            </h1>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {paymentStatus === 'success' && (
          <>
            <FaCheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              ¡Pago exitoso!
            </h1>
            <p className="text-gray-600 mb-4">{message}</p>
            {userProfile?.subscription && (
              <div className="bg-green-50 rounded-lg p-4 mb-4">
                <p className="text-green-800 font-semibold">
                  Plan: {userProfile.subscription.plan}
                </p>
                <p className="text-green-600 text-sm">
                  Estado: {userProfile.subscription.status}
                </p>
              </div>
            )}
            <p className="text-sm text-gray-500 mb-4">
              Redirigiendo en unos segundos...
            </p>
            <button
              onClick={() => router.push('/')}
              className="w-full bg-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
            >
              <FaHome className="w-4 h-4" />
              Ir al diario
            </button>
          </>
        )}

        {paymentStatus === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-red-500 text-2xl">❌</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Error en el pago
            </h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/subscription')}
                className="w-full bg-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Intentar de nuevo
              </button>
              <button
                onClick={() => router.push('/')}
                className="w-full bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                <FaHome className="w-4 h-4" />
                Ir al diario
              </button>
            </div>
          </>
        )}

        {paymentStatus === 'none' && (
          <>
            <FaHome className="w-16 h-16 text-purple-600 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Dashboard
            </h1>
            <p className="text-gray-600 mb-6">
              ¡Bienvenido de vuelta, {user.displayName || user.email}!
            </p>
            <button
              onClick={() => router.push('/')}
              className="w-full bg-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
            >
              <FaHome className="w-4 h-4" />
              Ir al diario
            </button>
          </>
        )}
      </div>
    </div>
  );
}
