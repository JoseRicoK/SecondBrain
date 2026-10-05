"use client";

import { authenticatedFetch } from "@/lib/authenticated-fetch";

import { useRef, useState, useEffect } from "react";

import { navigateToBilling } from "@/lib/billing-navigation";

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
  enabled: boolean;
}

export default function CheckoutForm({
  plan,
  userId,
  userEmail,
  displayName,
  enabled,
}: CheckoutFormProps) {
  const checkoutAttempt = useRef<{ key: string; id: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setIsLoading(false);
    setError(null);
    setPending(false);
    return () => {
      generation.current++;
    };
  }, [userId, plan.name]);

  const handleCheckout = async () => {
    if (!enabled) return;
    const current = generation.current;
    try {
      setIsLoading(true);
      setError(null);

      // Determinar el tipo de plan basado en el nombre
      const planTypeMap: Record<string, string> = {
        Pro: "pro",
        Elite: "elite",
      };

      const planType = planTypeMap[plan.name];

      if (!planType) {
        throw new Error("Tipo de plan no válido");
      }

      const attemptKey = `${userId}:${planType}`;
      if (checkoutAttempt.current?.key !== attemptKey)
        checkoutAttempt.current = { key: attemptKey, id: crypto.randomUUID() };

      // Crear la sesión de checkout
      const response = await authenticatedFetch(
        "/api/stripe/create-checkout-session",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requestId: checkoutAttempt.current.id,
            planType,
            userId,
            userEmail,
            displayName,
          }),
        },
      );

      const {
        checkoutUrl,
        portalUrl,
        error: apiError,
        code,
      } = await response.json();
      if (current !== generation.current) return;
      setPending(code === "CHECKOUT_PENDING");

      if (apiError) {
        throw new Error(apiError);
      }

      if (!response.ok) throw new Error("No se pudo iniciar el pago");
      navigateToBilling(
        portalUrl || checkoutUrl,
        portalUrl ? "portal" : "checkout",
      );
    } catch (err) {
      if (current !== generation.current) return;
      console.error("Error en checkout:", err);
      setError(
        err instanceof Error ? err.message : "Error al procesar el pago",
      );
    } finally {
      if (current === generation.current) setIsLoading(false);
    }
  };

  const cancelAttempt = async () => {
    const current = generation.current;
    setIsLoading(true);
    try {
      const response = await authenticatedFetch(
        "/api/stripe/cancel-checkout-session",
        { method: "POST" },
      );
      const data = await response.json();
      if (current !== generation.current) return;
      if (!response.ok) throw new Error(data.error);
      checkoutAttempt.current = null;
      setPending(false);
      setError("Intento cancelado. Puedes iniciar un nuevo pago.");
    } catch (error) {
      if (current === generation.current)
        setError(
          error instanceof Error
            ? error.message
            : "No se pudo cancelar el intento",
        );
    } finally {
      if (current === generation.current) setIsLoading(false);
    }
  };
  const IconComponent = plan.icon;

  return (
    <div className="bg-white rounded-xl p-8 shadow-lg">
      <div className="text-center mb-6">
        <div
          className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r ${plan.color} flex items-center justify-center`}
        >
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

        <p className="text-gray-600 mb-6">{plan.description}</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {pending && (
        <button
          type="button"
          disabled={isLoading}
          onClick={cancelAttempt}
          className="mb-4 w-full rounded-xl border border-purple-500 p-3 font-semibold text-purple-700"
        >
          Cancelar intento de pago pendiente
        </button>
      )}
      <button
        onClick={handleCheckout}
        disabled={isLoading || !enabled}
        className={`w-full py-4 px-6 rounded-xl text-white font-semibold text-lg transition-all duration-300 ${
          isLoading || !enabled
            ? "bg-gray-400 cursor-not-allowed"
            : `bg-gradient-to-r ${plan.color} hover:shadow-xl hover:scale-105 transform`
        }`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            Procesando...
          </div>
        ) : !enabled ? (
          "Pagos disponibles próximamente"
        ) : (
          `Suscribirse a ${plan.name}`
        )}
      </button>

      {enabled && (
        <p className="text-xs text-gray-500 mt-4 text-center">
          Pago seguro procesado por Stripe. Cancela en cualquier momento.
        </p>
      )}
    </div>
  );
}
