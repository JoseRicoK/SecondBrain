"use client";
import { useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { navigateToBilling } from "@/lib/billing-navigation";
export default function BillingPortalButton({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setBusy(false);
    setError("");
    return () => {
      generation.current++;
    };
  }, [userId]);
  const open = async () => {
    const current = generation.current;
    setBusy(true);
    setError("");
    try {
      const response = await authenticatedFetch(
        "/api/stripe/create-portal-session",
        { method: "POST" },
      );
      const data = await response.json();
      if (current !== generation.current) return;
      if (!response.ok)
        throw new Error(data.error || "No se pudo abrir la facturación");
      navigateToBilling(data.url, "portal");
    } catch (error) {
      if (current === generation.current)
        setError(
          error instanceof Error
            ? error.message
            : "No se pudo abrir la facturación",
        );
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };
  return (
    <div className="my-6 text-center">
      <button
        type="button"
        disabled={busy}
        onClick={open}
        className="rounded-xl border border-purple-500 bg-white px-6 py-3 font-semibold text-purple-700 disabled:opacity-60"
      >
        {busy
          ? "Abriendo facturación…"
          : "Gestionar facturación y cambiar de plan"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-red-700">
          {error}
        </p>
      )}
      <p className="mt-2 text-sm text-gray-600">
        Gestiona tu método de pago, facturas y suscripción en Stripe.
      </p>
    </div>
  );
}
