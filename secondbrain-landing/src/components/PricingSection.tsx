import { PLAN_PRICING } from "@/lib/plan-pricing";
import Link from "next/link";
import { APP_URL, SIGNUP_URL } from "@/lib/site";
import { FALLBACK_CATALOG, type Catalog } from "@/lib/plans";
export default function PricingSection({
  catalog = FALLBACK_CATALOG,
}: {
  catalog?: Catalog;
}) {
  const names = { free: "Gratuito", pro: "Pro", elite: "Elite" };
  const descriptions = {
    free: "Conoce el diario y empieza tu rutina.",
    pro: "Más conversaciones y acceso a informes.",
    elite: "Más mensajes para reflexionar a tu ritmo.",
  };
  const prices = Object.fromEntries(
    Object.entries(PLAN_PRICING.amounts).map(([id, cents]) => [id, cents / 100]),
  );
  const quantity = (n: number) => (n === -1 ? "Ilimitados" : String(n));
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <header className="mx-auto mb-12 max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Planes para tu diario personal con IA
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-300">
          Empieza gratis, sin tarjeta. Todos los planes usan la misma IA; cambia
          el número de conversaciones y el acceso a informes.
        </p>
      </header>
      {!catalog.checkoutEnabled && (
        <p
          role="status"
          className="mb-8 rounded-xl border border-purple-400/30 bg-purple-950/40 p-5 text-center text-purple-100"
        >
          El registro gratuito está disponible. Pro y Elite estarán disponibles
          próximamente; todavía no puedes contratar ni pagar estos planes.
        </p>
      )}
      {!catalog.verified && (
        <p className="mb-6 text-center text-sm text-slate-300">
          No hemos podido actualizar el catálogo. Estos son los límites de
          referencia; comprueba los vigentes en la app.
        </p>
      )}
      <div className="grid gap-6 md:grid-cols-3">
        {(["free", "pro", "elite"] as const).map((id) => (
          <article
            key={id}
            className="flex flex-col rounded-3xl border border-white/15 bg-slate-900/80 p-7"
          >
            <h2 className="text-2xl font-bold text-white">{names[id]}</h2>
            <p className="mt-3 min-h-14 text-slate-300">{descriptions[id]}</p>
            <p className="my-6">
              <span className="text-4xl font-bold text-white">
                {new Intl.NumberFormat("es-ES", {
                  style: "currency",
                  currency: "EUR",
                }).format(prices[id])}
              </span>
              <span className="text-slate-400"> /mes</span>
            </p>
            <ul className="mb-8 space-y-4 text-slate-200">
              <li>Diario por texto y voz</li>
              <li>
                {quantity(catalog.limits[id].personalChatMessages)} mensajes de
                chat personal /mes
              </li>
              <li>
                {quantity(catalog.limits[id].personChatMessages)} mensajes sobre
                personas /mes
              </li>
              <li>
                {catalog.limits[id].statisticsAccess === 0
                  ? "Sin informes de estadísticas"
                  : quantity(catalog.limits[id].statisticsAccess) +
                    " informes de estadísticas /mes"}
              </li>
              <li>Organización por fechas y personas</li>
            </ul>
            <Link
              href={
                id === "free" || !catalog.checkoutEnabled
                  ? SIGNUP_URL
                  : APP_URL + "/signup?plan=" + id
              }
              className="mt-auto block rounded-xl bg-purple-600 px-5 py-3 text-center font-semibold text-white hover:bg-purple-500"
            >
              {id === "free"
                ? "Comenzar Gratis"
                : catalog.checkoutEnabled
                  ? "Comenzar " + names[id]
                  : "Empezar gratis mientras llega " + names[id]}
            </Link>
            <p className="mt-4 text-sm text-slate-400">
              {id === "free"
                ? "Sin tarjeta ni suscripción de pago."
                : catalog.checkoutEnabled
                  ? "Renovación mensual. Cancelación al final del periodo pagado."
                  : "Precio previsto al habilitar la contratación."}
            </p>
          </article>
        ))}
      </div>
      <p className="mx-auto mt-8 max-w-3xl text-center leading-7 text-slate-300">
        Las cuotas se renuevan el día 1 de cada mes a las 00:00 UTC. Cambiar de
        plan conserva el consumo del mes. Consultar gráficas de un informe ya
        generado no consume otro informe.
      </p>
    </section>
  );
}
