"use client";

import { PLAN_PRICING } from "@/lib/plan-pricing";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSupabaseAuthContext } from "@/contexts/SupabaseAuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import {
  FaCrown,
  FaCheck,
  FaArrowLeft,
  FaBookOpen,
  FaRegComment,
  FaUsers,
  FaChartBar,
  FaMicrophone,
  FaArrowRight,
} from "react-icons/fa";
import { FiZap } from "react-icons/fi";
import { IconType } from "react-icons";
import BillingPortalButton from "@/components/BillingPortalButton";
import CheckoutForm from "@/components/CheckoutForm";
import Link from "next/link";
import styles from "./subscription.module.css";
import { PLAN_LIMITS } from "@/lib/subscription-policy";

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

const basePlans = {
  free: {
    name: "Gratuito",
    price: 0,
    description: "Un espacio para empezar a guardar tu historia.",
    icon: FaBookOpen,
    color: "from-slate-500 to-slate-600",
  },
  pro: {
    name: "Pro",
    price: PLAN_PRICING.amounts.pro / 100,
    description: "Más conversaciones y perspectiva sobre lo que vives.",
    icon: FiZap,
    color: "from-purple-500 to-pink-500",
  },
  elite: {
    name: "Elite",
    price: PLAN_PRICING.amounts.elite / 100,
    description: "Más espacio para conversar y explorar tus recuerdos.",
    icon: FaCrown,
    color: "from-violet-600 to-indigo-600",
  },
};
const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(price);
const formatLimit = (value: number) =>
  value === -1 ? "Ilimitados" : String(value);

function SubscriptionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useSupabaseAuthContext();
  const { currentPlan: userCurrentPlan, userProfile } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<
    keyof typeof basePlans | "free"
  >("pro");
  const [showCheckout, setShowCheckout] = useState(false);
  const [plans, setPlans] = useState<Record<string, PlanData> | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [checkoutEnabled, setCheckoutEnabled] = useState(false);

  // Cargar los plan IDs desde la API
  useEffect(() => {
    const fetchPlanIds = async () => {
      try {
        setPlansLoading(true);
        const response = await fetch("/api/subscription/plans");

        if (!response.ok) {
          throw new Error("Error al cargar los planes");
        }

        const planIds = await response.json();

        // Combinar los datos base con los priceId obtenidos de la API
        const fullPlans: Record<string, PlanData> = {};
        Object.entries(basePlans).forEach(([key, basePlan]) => {
          fullPlans[key] = {
            ...basePlan,
            features: (() => {
              const limit =
                planIds.limits?.[key] ??
                PLAN_LIMITS[key as keyof typeof basePlans];
              return [
                {
                  text: `${formatLimit(limit.personalChatMessages)} mensajes de chat personal por mes`,
                  included: true,
                },
                {
                  text: `${formatLimit(limit.personChatMessages)} mensajes con personas por mes`,
                  included: true,
                },
                {
                  text:
                    limit.statisticsAccess === -1
                      ? "Informes de estadísticas ilimitados"
                      : `${limit.statisticsAccess} informes de estadísticas por mes`,
                  included: key !== "free",
                },
                {
                  text: "Gráficas del estado de ánimo",
                  included: key !== "free",
                },
              ];
            })(),
            priceId: typeof planIds[key] === "string" ? planIds[key] : "",
          };
        });

        setPlans(fullPlans);
        setCheckoutEnabled(planIds.checkoutEnabled === true);
        setPlansError(null);
      } catch (error) {
        console.error("Error cargando planes:", error);
        setPlansError("Error al cargar los planes");
      } finally {
        setPlansLoading(false);
      }
    };

    fetchPlanIds();
  }, []);

  useEffect(() => {
    // Obtener el plan de la URL solo cuando los planes estén cargados
    if (plans) {
      const planFromUrl = searchParams.get("plan") as keyof typeof basePlans;
      if (planFromUrl && plans[planFromUrl]) {
        setSelectedPlan(planFromUrl);
      }
    }
  }, [searchParams, plans]);

  // Redirigir si no está autenticado
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
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
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Error al cargar los planes
          </h2>
          <p className="text-gray-600 mb-4">
            {plansError || "No se pudieron cargar los planes de suscripción"}
          </p>
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
                .filter((f) => f.included)
                .map((f) => f.text),
            }}
            userId={user.uid}
            userEmail={user.email || ""}
            displayName={user.displayName || undefined}
            enabled={checkoutEnabled}
          />
        </div>
      </div>
    );
  }

  const cancelSubscription = async () => {
    const confirmCancel = confirm(
      `¿Estás seguro de que quieres cancelar tu suscripción ${userCurrentPlan.toUpperCase()}?\n\n` +
        `• Conservarás el acceso completo hasta ${
          userProfile?.subscription.currentPeriodEnd
            ? new Date(
                userProfile?.subscription.currentPeriodEnd,
              ).toLocaleDateString("es-ES")
            : "el final del período facturado"
        }\n` +
        `• Después cambiarás automáticamente al plan gratuito\n` +
        `• No se realizarán más cobros\n\n` +
        `Esta acción no se puede deshacer.`,
    );

    if (!confirmCancel) return;

    try {
      const response = await authenticatedFetch(
        "/api/stripe/cancel-subscription",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.uid }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        alert(
          `✅ Suscripción cancelada correctamente.\n\n` +
            `Tu plan ${userCurrentPlan.toUpperCase()} permanecerá activo hasta: ${new Date(data.cancelAt).toLocaleDateString("es-ES")}\n\n` +
            `Después cambiarás automáticamente al plan gratuito.`,
        );
        router.push("/");
      } else {
        const errorData = await response.json();
        alert(`❌ Error al cancelar suscripción: ${errorData.error}`);
      }
    } catch (error) {
      alert("❌ Error de conexión al cancelar suscripción");
      console.error("Error:", error);
    }
  };
  const activateFree = async () => {
    try {
      const response = await authenticatedFetch(
        "/api/subscription/update-manual",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.uid,
            planType: "free",
          }),
        },
      );

      if (response.ok) {
        alert("✅ ¡Plan gratuito activado! Redirigiendo al dashboard...");
        window.location.href = "/";
      } else {
        alert("❌ Error al activar el plan gratuito");
      }
    } catch (error) {
      alert("❌ Error de conexión");
      console.error("Error:", error);
    }
  };
  const activePaid =
    userCurrentPlan !== "free" && userProfile?.subscription.status === "active";
  const samePaidPlan = activePaid && selectedPlan === userCurrentPlan;
  const hasBillingAccount = Boolean(userProfile?.subscription.stripeCustomerId);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <nav
          className={styles.navigation}
          aria-label="Navegación de suscripción"
        >
          <Link href="/" className={styles.back}>
            <FaArrowLeft aria-hidden="true" /> Volver a mi diario
          </Link>
          <Link href="/" className={styles.brand}>
            <img src="/brand/logo.png" alt="" width={32} height={32} />{" "}
            LumaDiary
          </Link>
        </nav>

        <header className={styles.header}>
          <span className={styles.eyebrow}>A TU RITMO</span>
          <h1>
            Un espacio para ti.
            <br />
            <span>Un plan a tu medida.</span>
          </h1>
          <p>
            Empieza con lo esencial o dedica más espacio a tus conversaciones y
            recuerdos.
          </p>
          <div className={styles.currentPlan}>
            <span /> Tu plan actual:{" "}
            <strong>{plans[userCurrentPlan]?.name ?? "Gratuito"}</strong>
          </div>
        </header>

        <section
          className={styles.plans}
          aria-label="Comparar planes mensuales"
        >
          {Object.entries(plans).map(([key, plan]) => {
            const PlanIcon = plan.icon;
            const selected = selectedPlan === key;
            const isCurrent = userCurrentPlan === key;
            return (
              <button
                type="button"
                key={key}
                aria-label={`Seleccionar plan ${plan.name}`}
                aria-pressed={selected}
                onClick={() => setSelectedPlan(key as keyof typeof basePlans)}
                className={`${styles.card} ${key === "pro" ? styles.pro : ""} ${selected ? styles.selected : ""}`}
              >
                <div className={styles.cardTop}>
                  <span className={styles.planIcon}>
                    <PlanIcon aria-hidden="true" />
                  </span>
                  <span className={styles.badge}>
                    {isCurrent
                      ? "Tu plan actual"
                      : key === "pro"
                        ? "Para ir un poco más allá"
                        : key === "elite"
                          ? "Más capacidad"
                          : "Para empezar"}
                  </span>
                </div>
                <span className={styles.planName}>{plan.name}</span>
                <span className={styles.description}>{plan.description}</span>
                <span className={styles.price}>
                  {plan.price === 0 ? "Gratis" : formatPrice(plan.price)}
                  <span>{plan.price === 0 ? "sin tarjeta" : "/ mes"}</span>
                </span>
                <span className={styles.divider} />
                <span className={styles.featureLabel}>TU ESPACIO INCLUYE</span>
                <span className={styles.features}>
                  {plan.features.map((feature, index) => {
                    const FeatureIcon = [
                      FaRegComment,
                      FaUsers,
                      FaChartBar,
                      FaChartBar,
                    ][index];
                    return (
                      <span
                        key={feature.text}
                        className={
                          feature.included ? styles.feature : styles.unavailable
                        }
                      >
                        <FeatureIcon aria-hidden="true" />
                        <span>
                          {feature.included
                            ? feature.text
                            : index === 2
                              ? "Sin informes de estadísticas"
                              : "Sin gráficas del estado de ánimo"}
                        </span>
                      </span>
                    );
                  })}
                </span>
                <span className={styles.selectLabel}>
                  {selected ? (
                    <>
                      <FaCheck aria-hidden="true" /> Plan seleccionado
                    </>
                  ) : (
                    <>
                      Elegir {plan.name}
                      <FaArrowRight aria-hidden="true" />
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </section>

        <section
          className={styles.shared}
          aria-label="Incluido en todos los planes"
        >
          <span className={styles.sharedHeading}>En todos los planes</span>
          <span>
            <FaBookOpen aria-hidden="true" /> Diario por fechas
          </span>
          <span>
            <FaMicrophone aria-hidden="true" /> Transcripciones ilimitadas
          </span>
          <span>
            <FiZap aria-hidden="true" /> Estilización con IA
          </span>
          <span>
            <FaUsers aria-hidden="true" /> Organización de personas
          </span>
        </section>

        <section
          className={styles.action}
          aria-label="Gestionar el plan seleccionado"
          aria-live="polite"
        >
          <div className={styles.actionCopy}>
            <span className={styles.eyebrow}>
              HAS ELEGIDO {currentPlan.name.toUpperCase()}
            </span>
            <h2>
              {selectedPlan === "free"
                ? activePaid
                  ? "Vuelve al plan gratuito"
                  : "Tu historia empieza aquí"
                : samePaidPlan
                  ? `Ya tienes el plan ${currentPlan.name}`
                  : `Más espacio con ${currentPlan.name}`}
            </h2>
            <p>
              {selectedPlan === "free"
                ? activePaid
                  ? `Conservarás tu plan actual hasta ${userProfile?.subscription.currentPeriodEnd ? new Date(userProfile?.subscription.currentPeriodEnd).toLocaleDateString("es-ES") : "el final del período facturado"}. Después pasarás al plan gratuito.`
                  : "Escribe, guarda tus recuerdos y empieza a conversar a tu ritmo."
                : samePaidPlan
                  ? "Tu suscripción está activa. Puedes volver a tu diario o gestionar tu plan."
                  : "Las cuotas con personas se comparten entre todos esos chats. El consumo se renueva el día 1 de cada mes, a las 00:00 UTC."}
            </p>
          </div>
          <div className={styles.actionControls}>
            {selectedPlan === "free" ? (
              activePaid ? (
                <>
                  <button
                    type="button"
                    className={styles.dangerButton}
                    onClick={cancelSubscription}
                  >
                    Cancelar Suscripción y Cambiar a Gratuito
                  </button>
                  <Link
                    href="/?settings=true"
                    className={styles.secondaryButton}
                  >
                    Gestionar suscripción
                  </Link>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={activateFree}
                >
                  Comenzar con Gratuito <FaArrowRight aria-hidden="true" />
                </button>
              )
            ) : samePaidPlan ? (
              <>
                <Link href="/" className={styles.primaryButton}>
                  Volver a mi diario <FaArrowRight aria-hidden="true" />
                </Link>
                <Link href="/?settings=true" className={styles.secondaryButton}>
                  Gestionar suscripción
                </Link>
              </>
            ) : checkoutEnabled ? (
              hasBillingAccount ? (
                <BillingPortalButton userId={user.uid} />
              ) : (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => setShowCheckout(true)}
                >
                  Comenzar con {currentPlan.name} ·{" "}
                  {formatPrice(currentPlan.price)}/mes{" "}
                  <FaArrowRight aria-hidden="true" />
                </button>
              )
            ) : (
              <div className={styles.paymentNotice}>
                <span>Próximamente</span>
                <p>
                  Los pagos estarán disponibles próximamente. Puedes seguir
                  usando el plan gratuito.
                </p>
                <Link href="/">
                  Volver a mi diario <FaArrowRight aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        </section>

        <footer className={styles.footer}>
          <p>
            Facturación mensual en planes de pago. Puedes cancelar desde tus
            ajustes; conservarás el acceso hasta el final del período facturado.
          </p>
          <div>
            <a
              href="https://www.lumadiary.com/terminos"
              target="_blank"
              rel="noopener noreferrer"
            >
              Condiciones
            </a>
            <a
              href="https://www.lumadiary.com/privacidad"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacidad
            </a>
            <a
              href="https://www.lumadiary.com/soporte"
              target="_blank"
              rel="noopener noreferrer"
            >
              ¿Necesitas ayuda?
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.loading} role="status">
          Cargando planes...
        </div>
      }
    >
      <SubscriptionContent />
    </Suspense>
  );
}
