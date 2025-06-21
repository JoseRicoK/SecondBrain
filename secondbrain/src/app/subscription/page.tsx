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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 relative">
      {/* Subtle background elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-10 left-10 w-32 h-32 bg-purple-300 rounded-full blur-3xl"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-pink-300 rounded-full blur-2xl"></div>
        <div className="absolute bottom-20 left-1/4 w-40 h-40 bg-blue-300 rounded-full blur-3xl"></div>
        <div className="absolute bottom-40 right-1/3 w-28 h-28 bg-indigo-300 rounded-full blur-2xl"></div>
      </div>
      
      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header Section */}
        <div className="text-center mb-16">
          <div className="inline-block p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl mb-6 shadow-lg">
            <FaCrown className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Elige tu Plan Perfecto
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Descubre todo lo que SecondBrain puede hacer por ti. Comienza gratis o elige un plan premium para desbloquear todo el potencial.
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {Object.entries(plans).map(([key, plan]) => {
            const PlanIcon = plan.icon;
            const isSelected = selectedPlan === key;
            const isPopular = key === 'pro';
            
            return (
              <div
                key={key}
                onClick={() => setSelectedPlan(key as keyof typeof basePlans)}
                className={`relative cursor-pointer transition-all duration-300 rounded-3xl p-8 border-2 hover:-translate-y-2 hover:rotate-1 ${
                  isSelected 
                    ? 'border-purple-500 bg-white shadow-2xl -translate-y-1 rotate-1 ring-4 ring-purple-200' 
                    : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-xl'
                } ${isPopular ? 'md:transform md:-translate-y-2' : ''}`}
              >
                {/* Popular Badge */}
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg animate-pulse">
                      ⭐ Más Popular
                    </div>
                  </div>
                )}

                {/* Free Badge */}
                {key === 'free' && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg">
                      💚 Gratis
                    </div>
                  </div>
                )}

                {/* Elite Badge */}
                {key === 'elite' && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg">
                      👑 Elite
                    </div>
                  </div>
                )}

                <div className="text-center">
                  {/* Icon */}
                  <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-r ${plan.color} flex items-center justify-center shadow-lg transition-transform duration-300 hover:rotate-12`}>
                    <PlanIcon className="w-10 h-10 text-white" />
                  </div>
                  
                  {/* Plan Name */}
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">
                    {plan.name}
                  </h3>
                  
                  {/* Price */}
                  <div className="mb-6">
                    {plan.price === 0 ? (
                      <div className="text-4xl font-bold text-gray-800">
                        <span className="bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
                          Gratis
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-4xl font-bold text-gray-800">
                          €{plan.price}
                        </span>
                        <span className="text-gray-600 text-lg">/mes</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Description */}
                  <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                    {plan.description}
                  </p>
                  
                  {/* Features List */}
                  <div className="text-left">
                    <ul className="space-y-4">
                      {plan.features.map((feature, index: number) => (
                        <li key={index} className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {feature.included ? (
                              <div className="w-6 h-6 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
                                <FaCheck className="w-3 h-3 text-white" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 bg-gradient-to-r from-red-400 to-pink-500 rounded-full flex items-center justify-center">
                                <FaTimes className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                          <span className={`text-sm leading-relaxed ${
                            feature.included 
                              ? 'text-gray-700 font-medium' 
                              : 'text-gray-400 line-through'
                          }`}>
                            {feature.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Selection Indicator */}
                {isSelected && (
                  <div className="absolute -top-2 -right-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                      <FaCheck className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Section */}
        <div className="text-center">
          {selectedPlan === 'free' ? (
            userCurrentPlan !== 'free' && userProfile?.subscription.status === 'active' ? (
              // Usuario tiene plan pagado y quiere cancelar para ir a gratuito
              <div className="max-w-lg mx-auto">
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-3xl p-8 mb-8 shadow-lg">
                  <div className="text-amber-600 text-5xl mb-4">⚠️</div>
                  <h3 className="text-2xl font-bold text-amber-800 mb-3">
                    Cancelar Suscripción
                  </h3>
                  <p className="text-amber-700 mb-6 leading-relaxed">
                    Actualmente tienes el plan <strong className="bg-amber-200 px-2 py-1 rounded">{userCurrentPlan.toUpperCase()}</strong>. 
                    Para cambiar al plan gratuito necesitas cancelar tu suscripción actual.
                  </p>
                  <div className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-2xl p-4 mb-6 border border-amber-200">
                    <p className="text-amber-800 text-sm leading-relaxed">
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
                  className="w-full inline-flex items-center justify-center gap-3 px-10 py-5 rounded-2xl bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold text-lg transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:rotate-1 group shadow-lg"
                >
                  <IconComponent className="w-6 h-6 transition-transform duration-300 group-hover:rotate-12" />
                  Cancelar Suscripción y Cambiar a Gratuito
                </button>
                
                <div className="mt-6 flex gap-4 justify-center">
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="px-8 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 font-medium shadow-lg hover:shadow-xl hover:-translate-y-1"
                  >
                    Mantener Plan Actual
                  </button>
                  <button
                    onClick={() => router.push('/dashboard?settings=true')}
                    className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-300 font-medium shadow-lg hover:shadow-xl hover:-translate-y-1"
                  >
                    Gestionar en Settings
                  </button>
                </div>
              </div>
            ) : (
              // Usuario ya está en plan gratuito o no tiene plan activo
              <div className="max-w-md mx-auto">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-3xl p-6 mb-6">
                  <div className="text-green-600 text-4xl mb-3">💚</div>
                  <h3 className="text-xl font-bold text-green-800 mb-2">Plan Gratuito</h3>
                  <p className="text-green-700 text-sm">
                    ¡Perfecto para comenzar! Puedes actualizar en cualquier momento.
                  </p>
                </div>
                
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
                  className={`inline-flex items-center gap-3 px-10 py-5 rounded-2xl text-white font-bold text-lg transition-all duration-300 bg-gradient-to-r ${currentPlan.color} hover:shadow-2xl hover:-translate-y-1 hover:rotate-1 group shadow-lg`}
                >
                  <IconComponent className="w-6 h-6 transition-transform duration-300 group-hover:rotate-12" />
                  Comenzar con {currentPlan.name} - ¡Gratis!
                </button>
              </div>
            )
          ) : userCurrentPlan === selectedPlan && userProfile?.subscription.status === 'active' ? (
            // Usuario ya tiene este plan activo
            <div className="max-w-lg mx-auto">
              <div className="text-center p-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-3xl border-2 border-blue-200 shadow-lg">
                <div className="text-blue-600 text-6xl mb-6">✅</div>
                <h3 className="text-2xl font-bold text-blue-800 mb-3">
                  Ya tienes el plan {currentPlan.name}
                </h3>
                <p className="text-blue-600 mb-6 text-lg leading-relaxed">
                  Tu suscripción está activa y funcionando perfectamente. ¡Disfruta de todas las funciones premium!
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1"
                  >
                    Ir al Dashboard
                  </button>
                  {selectedPlan === 'pro' && (
                    <button
                      onClick={() => setSelectedPlan('elite')}
                      className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl hover:from-orange-600 hover:to-red-600 transition-all duration-300 font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1"
                    >
                      Mejorar a Elite 👑
                    </button>
                  )}
                  <button
                    onClick={() => router.push('/dashboard?settings=true')}
                    className="px-8 py-4 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-2xl hover:from-gray-700 hover:to-gray-800 transition-all duration-300 font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1"
                  >
                    Cancelar Suscripción
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-md mx-auto">
              <div className="mb-6">
                <div className={`inline-block p-4 bg-gradient-to-r ${currentPlan.color} rounded-2xl mb-4 shadow-lg`}>
                  <IconComponent className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">
                  {userCurrentPlan === 'free' ? (
                    <>¡Actualiza a {currentPlan.name}!</>
                  ) : (
                    <>Cambiar a {currentPlan.name}</>
                  )}
                </h3>
                <p className="text-gray-600 mb-6">
                  {userCurrentPlan === 'free' 
                    ? 'Desbloquea todo el potencial de SecondBrain'
                    : 'Cambia tu plan actual por uno que se ajuste mejor a tus necesidades'
                  }
                </p>
              </div>
              
              <button
                onClick={() => {
                  // Verificar downgrades no permitidos
                  if (userCurrentPlan === 'elite' && selectedPlan === 'pro') {
                    alert('No puedes cambiar de Elite a Pro directamente. Primero cancela tu suscripción actual desde Settings.');
                    return;
                  }
                  setShowCheckout(true);
                }}
                className={`inline-flex items-center gap-3 px-10 py-5 rounded-2xl text-white font-bold text-lg transition-all duration-300 bg-gradient-to-r ${currentPlan.color} hover:shadow-2xl hover:-translate-y-1 hover:rotate-1 group shadow-lg`}
              >
                <IconComponent className="w-6 h-6 transition-transform duration-300 group-hover:rotate-12" />
                {userCurrentPlan === 'free' ? (
                  <>Comenzar con {currentPlan.name} - €{currentPlan.price}/mes</>
                ) : (
                  <>Cambiar a {currentPlan.name} - €{currentPlan.price}/mes</>
                )}
              </button>
            </div>
          )}
          
          <div className="mt-8 max-w-2xl mx-auto">
            <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200">
              <p className="text-sm text-gray-600 leading-relaxed">
                {selectedPlan === 'free' 
                  ? (userCurrentPlan !== 'free' && userProfile?.subscription.status === 'active' 
                    ? '⚠️ Cancelar tu suscripción significa que cambiarás al plan gratuito al final de tu período de facturación actual.'
                    : '✨ ¡Comienza gratis! Puedes actualizar en cualquier momento para desbloquear más funciones premium.')
                  : '🔒 Política de cancelación flexible. Sin compromisos a largo plazo. Cancela en cualquier momento desde tu panel de configuración.'
                }
              </p>
              {selectedPlan !== 'free' && (
                <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Pago seguro con Stripe
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    Activación instantánea
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    Soporte 24/7
                  </span>
                </div>
              )}
            </div>
          </div>
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
