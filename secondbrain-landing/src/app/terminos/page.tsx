import { pageMetadata } from "@/lib/site";
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
  "Condiciones de acceso, uso del diario y funcionamiento de las suscripciones de SecondBrain.",
  "/terminos",
);

export default function TerminosPage() {
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
              Al usar SecondBrain aceptas estos términos. Léelos con atención
              para comprender tus derechos y responsabilidades.
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="px-4 sm:px-6 lg:px-8 pb-12">
          <div className="max-w-5xl mx-auto grid gap-6">
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
                  El plan gratuito está disponible. Los planes de pago requieren
                  que la contratación esté habilitada.
                </li>
                <li>
                  Una vez contratadas, las suscripciones se renuevan
                  mensualmente hasta que se cancelen.
                </li>
                <li>
                  Puedes cancelar en cualquier momento desde Configuración
                </li>
                <li>
                  Las funciones premium se mantienen hasta el fin del período
                  facturado
                </li>
              </ul>
            </div>

            <div className="liquid-card rounded-2xl p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl lg:text-2xl font-semibold text-white">
                  Limitación de Responsabilidad
                </h2>
              </div>
              <p className="text-gray-300">
                SecondBrain se ofrece «tal cual». No somos responsables de
                pérdidas indirectas o daños que surjan del uso del servicio.
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
