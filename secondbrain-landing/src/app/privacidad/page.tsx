import { pageMetadata } from "@/lib/site";
import { BUSINESS } from "@/lib/business";
import Footer from "@/components/Footer";
import Header from "../../components/Header";
import CtaSection from "../../components/CtaSection";
import { Shield, Lock, FileText, Mail } from "lucide-react";

export const metadata = pageMetadata(
  "Privacidad y tratamiento de datos",
  "Cómo se utilizan tus datos de cuenta y diario, qué proveedores procesan las funciones de IA y cómo solicitar ayuda sobre privacidad.",
  "/privacidad",
);

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative">
      <Header />

      <main id="main">
        {/* Hero */}
        <section className="pt-28 sm:pt-36 lg:pt-40 px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 mb-6">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
              Política de{" "}
              <span className="liquid-gradient-text">Privacidad</span>
            </h1>
            <p className="text-gray-300 text-lg max-w-3xl mx-auto">
              Tu diario está asociado a tu cuenta. Aquí explicamos cómo se
              procesa la información necesaria para ofrecer el servicio.
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="px-4 sm:px-6 lg:px-8 pb-12">
          <div className="max-w-5xl mx-auto grid gap-6">
            <div className="glass rounded-2xl p-6 lg:p-8">
              <h2 className="text-xl lg:text-2xl font-semibold text-white mb-4">
                Responsable del tratamiento
              </h2>
              <p className="text-gray-300">
                {BUSINESS.name}, NIF {BUSINESS.taxId}, con domicilio en{" "}
                {BUSINESS.address}. Puedes contactar en {BUSINESS.email} para
                ejercer tus derechos de acceso, rectificación, supresión,
                oposición, limitación y portabilidad.
              </p>
            </div>
            <div className="glass rounded-2xl p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-4">
                <Lock className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl lg:text-2xl font-semibold text-white">
                  Principios Clave
                </h2>
              </div>
              <ul className="text-gray-300 space-y-2 list-disc list-inside">
                <li>Encriptación en tránsito y en reposo</li>
                <li>Control de acceso con autenticación segura</li>
                <li>Transparencia y eliminación bajo solicitud</li>
              </ul>
            </div>

            <div className="liquid-card rounded-2xl p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl lg:text-2xl font-semibold text-white">
                  Datos que Recopilamos
                </h2>
              </div>
              <p className="text-gray-300 mb-3">
                Solo recopilamos lo necesario para ofrecer la experiencia:
              </p>
              <ul className="text-gray-300 space-y-2 list-disc list-inside">
                <li>Email y nombre para tu cuenta</li>
                <li>Entradas del diario y archivos que subas</li>
                <li>Contadores de uso para aplicar las cuotas de tu plan</li>
                <li>Datos de suscripción, facturación y estado de los pagos</li>
              </ul>
            </div>

            <div className="glass rounded-2xl p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl lg:text-2xl font-semibold text-white">
                  Cómo Protegemos tus Datos
                </h2>
              </div>
              <ul className="text-gray-300 space-y-2 list-disc list-inside">
                <li>
                  Supabase gestiona la base de datos y la autenticación; Vercel
                  aloja la web.
                </li>
                <li>
                  Las reglas de acceso de la base separan los datos de cada
                  usuario. No utilizamos cifrado de extremo a extremo.
                </li>
                <li>
                  OpenAI recibe el contenido necesario cuando utilizas funciones
                  de IA, incluidas las grabaciones que envías para transcribir.
                  Resend procesa los correos de cuenta y soporte. Estos
                  proveedores procesan datos para prestar sus servicios.
                </li>
                <li>
                  Stripe procesa los pagos y conserva los datos necesarios para
                  facturas, renovaciones y reembolsos. LumaDiary recibe los
                  identificadores y el estado de la suscripción; no almacena el
                  número completo de tu tarjeta. Tu diario no se envía a Stripe.
                </li>
              </ul>
            </div>

            <div className="liquid-card rounded-2xl p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl lg:text-2xl font-semibold text-white">
                  Contacto
                </h2>
              </div>
              <p className="text-gray-300">
                ¿Tienes dudas o quieres ejercer tus derechos? Escríbenos a{" "}
                <a
                  href="mailto:hello@secondbrainapp.com"
                  className="text-purple-300 hover:text-purple-200 underline"
                >
                  hello@secondbrainapp.com
                </a>
                .
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
