'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFirebaseAuthContext } from '@/contexts/FirebaseAuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { FaCrown, FaHeart, FaCheck, FaArrowLeft, FaTimes } from 'react-icons/fa';
import { FiZap } from 'react-icons/fi';
import { IconType } from 'react-icons';
import CheckoutForm from '@/components/CheckoutForm';

interface PlanData {
  name: string;
  price: number;
  priceId: string;
  description: string;
  icon: IconType;
  color: string;
  features: Array<{
    text: string;
    included: boolean;
  }>;
}

// Datos de los planes (sin priceId, que se obtendrá desde la API)
const basePlans = {
  free: {
    name: "Gratuito",
    price: 0,
    description: "Perfecto para empezar tu viaje personal",
    icon: FaHeart,
    color: "from-gray-500 to-slate-500",
    features: [
      { text: "🎙️ Transcripciones ilimitadas", included: true },
      { text: "💬 5 mensajes de chat personal por mes", included: true },
      { text: "👥 10 mensajes con personas por mes", included: true },
      { text: "📅 Navegación por fechas", included: true },
      { text: "🎨 Estilización básica de texto", included: true },
      { text: "👥 Extracción de personas", included: true },
      { text: "📊 Estadísticas avanzadas", included: false },
      { text: "🎨 Estilización con IA avanzada", included: false }
    ]
  },
  pro: {
    name: "Pro",
    price: 9.99,
    description: "Para usuarios serios sobre su crecimiento",
    icon: FiZap,
    color: "from-purple-500 to-pink-500",
    features: [
      { text: "✨ Todo del plan Gratuito", included: true },
      { text: "💬 30 mensajes de chat personal por mes", included: true },
      { text: "👥 100 mensajes con personas por mes", included: true },
      { text: "🎨 Estilización avanzada con IA", included: true },
      { text: "📊 10 estadísticas avanzadas por mes", included: true },
      { text: "🔍 Análisis inteligente mejorado", included: true },
      { text: "💬 100 mensajes de chat personal por mes", included: false },
      { text: "👥 500 mensajes con personas por mes", included: false },
      { text: "📊 Estadísticas ilimitadas", included: false }
    ]
  },
  elite: {
    name: "Elite",
    price: 19.99,
    description: "Para profesionales que buscan lo mejor",
    icon: FaCrown,
    color: "from-orange-500 to-red-500",
    features: [
      { text: "⭐ Todo del plan Pro", included: true },
      { text: "💬 100 mensajes de chat personal por mes", included: true },
      { text: "👥 500 mensajes con personas por mes", included: true },
      { text: "📊 Estadísticas avanzadas ilimitadas", included: true },
      { text: "🧠 Análisis profundo con IA", included: true },
      { text: "🏆 Soporte prioritario", included: true },
      { text: "🚀 Funciones experimentales", included: true }
    ]
  }
};

function SubscriptionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useFirebaseAuthContext();
  const { currentPlan: userCurrentPlan, userProfile } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<keyof typeof basePlans | 'free'>('pro');
  const [showCheckout, setShowCheckout] = useState(false);
  const [plans, setPlans] = useState<Record<string, PlanData> | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);

  // Cargar los plan IDs desde la API
  useEffect(() => {
    const fetchPlanIds = async () => {
      try {
        setPlansLoading(true);
        const response = await fetch('/api/subscription/plans');
        
        if (!response.ok) {
          throw new Error('Error al cargar los planes');
        }
        
        const planIds = await response.json();
        
        // Combinar los datos base con los priceId obtenidos de la API
        const fullPlans: Record<string, PlanData> = {};
        Object.entries(basePlans).forEach(([key, basePlan]) => {
          fullPlans[key] = {
            ...basePlan,
            priceId: planIds[key] || `price_${key}_monthly` // El plan free tendrá null como priceId
          };
        });
        
        setPlans(fullPlans);
        setPlansError(null);
      } catch (error) {
        console.error('Error cargando planes:', error);
        setPlansError('Error al cargar los planes');
      } finally {
        setPlansLoading(false);
      }
    };

    fetchPlanIds();
  }, []);

  useEffect(() => {
    // Obtener el plan de la URL solo cuando los planes estén cargados
    if (plans) {
      const planFromUrl = searchParams.get('plan') as keyof typeof basePlans;
      if (planFromUrl && plans[planFromUrl]) {
        setSelectedPlan(planFromUrl);
      }
    }
  }, [searchParams, plans]);

  // Redirigir si no está autenticado
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading || plansLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando planes...</p>
        </div>
      </div>
    );
  }

  if (plansError || !plans) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error al cargar los planes</h2>
          <p className="text-gray-600 mb-4">{plansError || 'No se pudieron cargar los planes de suscripción'}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-purple-500 text-white px-6 py-2 rounded-lg hover:bg-purple-600 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const currentPlan = plans[selectedPlan];
  const IconComponent = currentPlan.icon;

  if (showCheckout) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
        <div className="max-w-md mx-auto">
          <button
            onClick={() => setShowCheckout(false)}
            className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <FaArrowLeft className="w-5 h-5" />
            Volver a selección de plan
          </button>
          
          <CheckoutForm 
            plan={{
              ...currentPlan,
              features: currentPlan.features
                .filter(f => f.included)
                .map(f => f.text)
            }}
            userId={user.uid}
            userEmail={user.email || ''}
            displayName={user.displayName || undefined}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Completa tu suscripción
          </h1>
          <p className="text-xl text-gray-600">
            Solo falta un paso para comenzar tu viaje con SecondBrain
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {Object.entries(plans).map(([key, plan]) => {
            const PlanIcon = plan.icon;
            const isSelected = selectedPlan === key;
            
            return (
              <div
                key={key}
                onClick={() => setSelectedPlan(key as keyof typeof basePlans)}
                className={`cursor-pointer transition-all duration-300 rounded-2xl p-6 border-2 ${
                  isSelected 
                    ? 'border-purple-500 bg-white shadow-xl scale-105' 
                    : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-lg'
                }`}
              >
                <div className="text-center">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r ${plan.color} flex items-center justify-center`}>
                    <PlanIcon className="w-8 h-8 text-white" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    {plan.name}
                  </h3>
                  
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-gray-800">
                      €{plan.price}
                    </span>
                    <span className="text-gray-600">/mes</span>
                  </div>
                  
                  <p className="text-gray-600 mb-4">
                    {plan.description}
                  </p>
                  
                  <ul className="text-left space-y-2">
                    {plan.features.map((feature, index: number) => (
                      <li key={index} className="flex items-center gap-2">
                        {feature.included ? (
                          <FaCheck className="w-5 h-5 text-green-500 flex-shrink-0" />
                        ) : (
                          <FaTimes className="w-5 h-5 text-red-400 flex-shrink-0" />
                        )}
                        <span className={`text-sm ${
                          feature.included 
                            ? 'text-gray-700' 
                            : 'text-gray-400 line-through'
                        }`}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          {selectedPlan === 'free' ? (
            userCurrentPlan !== 'free' && userProfile?.subscription.status === 'active' ? (
              // Usuario tiene plan pagado y quiere cancelar para ir a gratuito
              <div className="max-w-md mx-auto">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
                  <div className="text-amber-600 text-4xl mb-3">⚠️</div>
                  <h3 className="text-lg font-semibold text-amber-800 mb-2">
                    Cancelar Suscripción
                  </h3>
                  <p className="text-amber-700 text-sm mb-4">
                    Actualmente tienes el plan <strong>{userCurrentPlan.toUpperCase()}</strong>. 
                    Para cambiar al plan gratuito necesitas cancelar tu suscripción actual.
                  </p>
                  <div className="bg-amber-100 rounded-lg p-3 mb-4">
                    <p className="text-amber-800 text-xs">
                      📅 <strong>Importante:</strong> Conservarás todas las funciones de tu plan actual hasta 
                      {userProfile.subscription.currentPeriodEnd ? 
                        ` el ${new Date(userProfile.subscription.currentPeriodEnd).toLocaleDateString('es-ES')}` : 
                        ' el final del período facturado'}. Después cambiarás automáticamente al plan gratuito.
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={async () => {
                    const confirmCancel = confirm(
                      `¿Estás seguro de que quieres cancelar tu suscripción ${userCurrentPlan.toUpperCase()}?\n\n` +
                      `• Conservarás el acceso completo hasta ${userProfile.subscription.currentPeriodEnd ? 
                        new Date(userProfile.subscription.currentPeriodEnd).toLocaleDateString('es-ES') : 
                        'el final del período facturado'}\n` +
                      `• Después cambiarás automáticamente al plan gratuito\n` +
                      `• No se realizarán más cobros\n\n` +
                      `Esta acción no se puede deshacer.`
                    );
                    
                    if (!confirmCancel) return;
                    
                    try {
                      const response = await fetch('/api/stripe/cancel-subscription', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: user.uid })
                      });
                      
                      if (response.ok) {
                        const data = await response.json();
                        alert(
                          `✅ Suscripción cancelada correctamente.\n\n` +
                          `Tu plan ${userCurrentPlan.toUpperCase()} permanecerá activo hasta: ${new Date(data.cancelAt).toLocaleDateString('es-ES')}\n\n` +
                          `Después cambiarás automáticamente al plan gratuito.`
                        );
                        router.push('/dashboard');
                      } else {
                        const errorData = await response.json();
                        alert(`❌ Error al cancelar suscripción: ${errorData.error}`);
                      }
                    } catch (error) {
                      alert('❌ Error de conexión al cancelar suscripción');
                      console.error('Error:', error);
                    }
                  }}
                  className="w-full inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold text-lg transition-all duration-300 hover:shadow-xl hover:scale-105 transform"
                >
                  <IconComponent className="w-6 h-6" />
                  Cancelar Suscripción y Cambiar a Gratuito
                </button>
                
                <div className="mt-4 flex gap-3 justify-center">
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                  >
                    Mantener Plan Actual
                  </button>
                  <button
                    onClick={() => router.push('/dashboard?settings=true')}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                  >
                    Gestionar en Settings
                  </button>
                </div>
              </div>
            ) : (
              // Usuario ya está en plan gratuito o no tiene plan activo
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/subscription/update-manual', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: user.uid, planType: 'free' })
                    });
                    
                    if (response.ok) {
                      alert('✅ ¡Plan gratuito activado! Redirigiendo al dashboard...');
                      window.location.href = '/dashboard';
                    } else {
                      alert('❌ Error al activar el plan gratuito');
                    }
                  } catch (error) {
                    alert('❌ Error de conexión');
                    console.error('Error:', error);
                  }
                }}
                className={`inline-flex items-center gap-3 px-8 py-4 rounded-xl text-white font-semibold text-lg transition-all duration-300 bg-gradient-to-r ${currentPlan.color} hover:shadow-xl hover:scale-105 transform`}
              >
                <IconComponent className="w-6 h-6" />
                Comenzar con {currentPlan.name} - ¡Gratis!
              </button>
            )
          ) : userCurrentPlan === selectedPlan && userProfile?.subscription.status === 'active' ? (
            // Usuario ya tiene este plan activo
            <div className="text-center p-6 bg-blue-50 rounded-xl border border-blue-200">
              <div className="text-blue-600 text-6xl mb-4">✅</div>
              <h3 className="text-xl font-semibold text-blue-800 mb-2">
                Ya tienes el plan {currentPlan.name}
              </h3>
              <p className="text-blue-600 mb-4">
                Tu suscripción está activa y funcionando perfectamente.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                >
                  Ir al Dashboard
                </button>
                {selectedPlan === 'pro' && (
                  <button
                    onClick={() => setSelectedPlan('elite')}
                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 transition-all font-medium"
                  >
                    Mejorar a Elite
                  </button>
                )}
                <button
                  onClick={() => router.push('/dashboard?settings=true')}
                  className="px-6 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors font-medium"
                >
                  Cancelar Suscripción
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                // Verificar downgrades no permitidos
                if (userCurrentPlan === 'elite' && selectedPlan === 'pro') {
                  alert('No puedes cambiar de Elite a Pro directamente. Primero cancela tu suscripción actual desde Settings.');
                  return;
                }
                setShowCheckout(true);
              }}
              className={`inline-flex items-center gap-3 px-8 py-4 rounded-xl text-white font-semibold text-lg transition-all duration-300 bg-gradient-to-r ${currentPlan.color} hover:shadow-xl hover:scale-105 transform`}
            >
              <IconComponent className="w-6 h-6" />
              {userCurrentPlan === 'free' ? (
                <>Comenzar con {currentPlan.name} - €{currentPlan.price}/mes</>
              ) : (
                <>Cambiar a {currentPlan.name} - €{currentPlan.price}/mes</>
              )}
            </button>
          )}
          
          <p className="text-sm text-gray-500 mt-4">
            {selectedPlan === 'free' 
              ? (userCurrentPlan !== 'free' && userProfile?.subscription.status === 'active' 
                ? '⚠️ Cancelar tu suscripción significa que cambiarás al plan gratuito al final de tu período de facturación actual.'
                : '¡Comienza gratis! Actualiza en cualquier momento para más funciones.')
              : 'Cancela en cualquier momento. Sin compromisos a largo plazo.'
            }
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando...</p>
      </div>
    </div>}>
      <SubscriptionContent />
    </Suspense>
  );
}
