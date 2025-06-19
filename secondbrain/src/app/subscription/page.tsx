'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFirebaseAuthContext } from '@/contexts/FirebaseAuthContext';
import { FaCrown, FaHeart, FaCheck, FaArrowLeft } from 'react-icons/fa';
import { FiZap } from 'react-icons/fi';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from '@/components/CheckoutForm';

// Configurar Stripe (necesitarás tu publishable key)
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const plans = {
  basic: {
    name: "Básico",
    price: 4.99,
    priceId: process.env.STRIPE_BASIC_PRICE_ID || "price_basic_monthly",
    description: "Perfecto para empezar tu viaje",
    icon: FaHeart,
    color: "from-green-500 to-emerald-500",
    features: [
      "Hasta 100 entradas por mes",
      "Grabación de voz básica",
      "Chat personal básico",
      "Navegación por fechas"
    ]
  },
  pro: {
    name: "Pro",
    price: 9.99,
    priceId: process.env.STRIPE_PRO_PRICE_ID || "price_pro_monthly",
    description: "Para usuarios serios sobre su crecimiento",
    icon: FiZap,
    color: "from-purple-500 to-pink-500",
    features: [
      "Entradas ilimitadas",
      "Grabación de voz avanzada",
      "Chat personal ilimitado",
      "Navegación por fechas",
      "Chats individuales por persona",
      "Transcripción ilimitada",
      "Estilización con IA"
    ]
  },
  elite: {
    name: "Elite",
    price: 19.99,
    priceId: process.env.STRIPE_ELITE_PRICE_ID || "price_elite_monthly",
    description: "Para profesionales y equipos",
    icon: FaCrown,
    color: "from-orange-500 to-red-500",
    features: [
      "Todo del plan Pro",
      "Análisis avanzado con IA",
      "Reportes personalizados",
      "Integraciones API",
      "Soporte prioritario",
      "Backup automático",
      "Colaboración en equipo",
      "Personalización avanzada"
    ]
  }
};

function SubscriptionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useFirebaseAuthContext();
  const [selectedPlan, setSelectedPlan] = useState<keyof typeof plans>('pro');
  const [showCheckout, setShowCheckout] = useState(false);

  // Debug: verificar variables de entorno
  useEffect(() => {
    console.log('🔍 Variables de entorno Stripe:', {
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? 'Configurada' : 'NO configurada',
      basicPriceId: process.env.STRIPE_BASIC_PRICE_ID || 'NO configurada',
      proPriceId: process.env.STRIPE_PRO_PRICE_ID || 'NO configurada',
      elitePriceId: process.env.STRIPE_ELITE_PRICE_ID || 'NO configurada'
    });
  }, []);

  useEffect(() => {
    // Obtener el plan de la URL
    const planFromUrl = searchParams.get('plan') as keyof typeof plans;
    if (planFromUrl && plans[planFromUrl]) {
      setSelectedPlan(planFromUrl);
    }
  }, [searchParams]);

  // Redirigir si no está autenticado
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-500"></div>
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
            plan={currentPlan}
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
                onClick={() => setSelectedPlan(key as keyof typeof plans)}
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
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <FaCheck className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <button
            onClick={() => setShowCheckout(true)}
            className={`inline-flex items-center gap-3 px-8 py-4 rounded-xl text-white font-semibold text-lg transition-all duration-300 bg-gradient-to-r ${currentPlan.color} hover:shadow-xl hover:scale-105 transform`}
          >
            <IconComponent className="w-6 h-6" />
            Continuar con {currentPlan.name} - €{currentPlan.price}/mes
          </button>
          
          <p className="text-sm text-gray-500 mt-4">
            Cancela en cualquier momento. Sin compromisos a largo plazo.
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
