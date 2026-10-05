import { pageMetadata } from "@/lib/site";
import { BUSINESS } from "@/lib/business";
import { PLAN_PRICING } from "@/lib/plan-pricing";
import Footer from "@/components/Footer";
import Header from "../../components/Header";
import CtaSection from "../../components/CtaSection";
import {
  FileText,
  Shield,
  CreditCard,
  AlertTriangle,
  Mail,
  UserCheck,
} from "lucide-react";

export const metadata = pageMetadata(
  "Términos y condiciones",
  "Condiciones de acceso, uso del diario y funcionamiento de las suscripciones de LumaDiary.",
  "/terminos",
);

export default function TerminosPage() {
  const price = (plan: "pro" | "elite") =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(PLAN_PRICING.amounts[plan] / 100);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative">
      <Header />

      <main id="main">
        {/* Hero */}
        <section className="pt-28 sm:pt-36 lg:pt-40 px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 mb-6">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
              Términos y{" "}
              <span className="liquid-gradient-text">Condiciones</span>
            </h1>
            <p className="text-gray-300 text-lg max-w-3xl mx-auto">
              Al usar LumaDiary aceptas estos términos. Léelos con atención para
              comprender tus derechos y responsabilidades.
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="px-4 sm:px-6 lg:px-8 pb-12">
          <div className="max-w-5xl mx-auto grid gap-6">
            <div className="glass rounded-2xl p-6 lg:p-8">
              <h2 className="text-xl lg:text-2xl font-semibold text-white mb-4">
                Titular del servicio
              </h2>
              <p className="text-gray-300">
                LumaDiary es un servicio de {BUSINESS.name}, NIF{" "}
                {BUSINESS.taxId}, con domicilio fiscal en {BUSINESS.address}.
                Contacto: {BUSINESS.email}.
              </p>
            </div>
            <div className="glass rounded-2xl p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-4">
                <UserCheck className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl lg:text-2xl font-semibold text-white">
                  Cuentas y Acceso
                </h2>
              </div>
              <ul className="text-gray-300 space-y-2 list-disc list-inside">
                <li>Solo para mayores de 16 años</li>
                <li>Mantén seguras tus credenciales de acceso</li>
                <li>Puedes cerrar tu cuenta y eliminar datos cuando quieras</li>
              </ul>
            </div>

            <div className="liquid-card rounded-2xl p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl lg:text-2xl font-semibold text-white">
                  Uso Aceptable
                </h2>
              </div>
              <ul className="text-gray-300 space-y-2 list-disc list-inside">
                <li>
                  No publiques contenido ilegal o que vulnere derechos de
                  terceros
                </li>
                <li>No intentes vulnerar la seguridad del servicio</li>
                <li>Respeta las leyes aplicables y estos términos</li>
              </ul>
            </div>

            <div className="glass rounded-2xl p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-4">
                <CreditCard className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl lg:text-2xl font-semibold text-white">
                  Pagos y Suscripciones
                </h2>
              </div>
              <ul className="text-gray-300 space-y-2 list-disc list-inside">
                <li>
                  Free es gratuito. Pro cuesta {price("pro")} al mes y Elite{" "}
                  {price("elite")} al mes. Son precios finales, con los
                  impuestos aplicables incluidos.
                </li>
                <li>
                  Una vez contratadas, las suscripciones se renuevan
                  mensualmente hasta que se cancelen.
                </li>
                <li>
                  Stripe procesa los pagos. Puedes consultar tus facturas,
                  actualizar el método de pago, cambiar de plan y cancelar la
                  renovación desde Suscripción en tu cuenta.
                </li>
                <li>
                  Las funciones premium se mantienen hasta el fin del período
                  facturado
                </li>
                <li>
                  Al subir de plan, Stripe muestra y cobra la diferencia
                  proporcional del periodo restante. Al bajar de plan, el cambio
                  se aplica en la siguiente renovación. Los contadores de uso
                  del mes se conservan.
                </li>
              </ul>
            </div>

            <div className="glass rounded-2xl p-6 lg:p-8">
              <h2 className="text-xl lg:text-2xl font-semibold text-white mb-4">
                Reembolsos y desistimiento
              </h2>
              <p className="text-gray-300 mb-3">
                Si solicitas un reembolso dentro de los 30 días naturales
                siguientes al último cargo mensual, te devolvemos íntegramente
                ese cargo. Revisamos las solicitudes sobre cargos anteriores
                caso por caso. Escribe a {BUSINESS.email} desde el correo de tu
                cuenta, indicando el cargo; no envíes datos de tarjeta.
              </p>
              <p className="text-gray-300 mb-3">
                El reembolso se realiza por el mismo medio de pago. Solicitarlo
                no cancela por sí solo futuras renovaciones: puedes cancelarlas
                desde Suscripción o pedirlo en el mismo mensaje. No elimina tu
                diario.
              </p>
              <p className="text-gray-300">
                Esta garantía comercial no limita tus derechos legales. Cuando
                contratas como consumidor, puedes desistir de la contratación
                inicial dentro de 14 días naturales escribiendo al mismo correo,
                sin necesidad de justificar tu decisión. Basta con indicar tu
                cuenta, fecha de contratación y que deseas desistir. No exigimos
                renunciar a ese derecho para empezar a usar el servicio.
              </p>
            </div>

            <div className="liquid-card rounded-2xl p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl lg:text-2xl font-semibold text-white">
                  Limitación de Responsabilidad
                </h2>
              </div>
              <p className="text-gray-300">
                Las funciones de IA pueden generar errores y no sustituyen
                asesoramiento profesional. Estas condiciones no excluyen ni
                limitan los derechos y garantías que reconoce la legislación
                aplicable a los consumidores.
              </p>
            </div>

            <div className="glass rounded-2xl p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl lg:text-2xl font-semibold text-white">
                  Contacto
                </h2>
              </div>
              <p className="text-gray-300">
                Para consultas sobre estos términos:{" "}
                <a
                  href="mailto:hello@secondbrainapp.com"
                  className="text-purple-300 hover:text-purple-200 underline"
                >
                  hello@secondbrainapp.com
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
