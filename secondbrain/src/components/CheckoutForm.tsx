'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CheckoutFormProps {
  plan: {
    name: string;
    price: number;
    priceId: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    features: string[];
  };
  userId: string;
  userEmail: string;
  displayName?: string;
}

export default function CheckoutForm({ plan, userId, userEmail, displayName }: CheckoutFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Determinar el tipo de plan basado en el nombre
      const planTypeMap: Record<string, string> = {
        'Básico': 'basic',
        'Pro': 'pro', 
        'Elite': 'elite'
      };
      
      const planType = planTypeMap[plan.name];
      
      if (!planType) {
        throw new Error('Tipo de plan no válido');
      }

      console.log('🎯 Enviando solicitud de checkout:', {
        planType,
        planName: plan.name,
        userId,
        userEmail
      });

      // Crear la sesión de checkout
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planType,
          userId,
          userEmail,
          displayName,
        }),
      });

      const { sessionId, error: apiError } = await response.json();

      if (apiError) {
        throw new Error(apiError);
      }

      // Redirigir a Stripe Checkout
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Stripe no se pudo cargar');
      }

      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId,
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }
    } catch (err) {
      console.error('Error en checkout:', err);
      setError(err instanceof Error ? err.message : 'Error al procesar el pago');
    } finally {
      setIsLoading(false);
    }
  };

  const IconComponent = plan.icon;

  return (
    <div className="bg-white rounded-xl p-8 shadow-lg">
      <div className="text-center mb-6">
        <div className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r ${plan.color} flex items-center justify-center`}>
          <IconComponent className="w-8 h-8 text-white" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Plan {plan.name}
        </h2>
        
        <div className="mb-4">
          <span className="text-3xl font-bold text-gray-800">
            €{plan.price}
          </span>
          <span className="text-gray-600">/mes</span>
        </div>
        
        <p className="text-gray-600 mb-6">
          {plan.description}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={handleCheckout}
        disabled={isLoading}
        className={`w-full py-4 px-6 rounded-xl text-white font-semibold text-lg transition-all duration-300 ${
          isLoading 
            ? 'bg-gray-400 cursor-not-allowed' 
            : `bg-gradient-to-r ${plan.color} hover:shadow-xl hover:scale-105 transform`
        }`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            Procesando...
          </div>
        ) : (
          `Suscribirse a ${plan.name}`
        )}
      </button>
      
      <p className="text-xs text-gray-500 mt-4 text-center">
        Pago seguro procesado por Stripe. Cancela en cualquier momento.
      </p>
    </div>
  );
}
