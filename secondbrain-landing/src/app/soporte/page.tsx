import type { Metadata } from 'next'
import Header from '../../components/Header'
import AnimatedBackground from '../../components/AnimatedBackground'
import CtaSection from '../../components/CtaSection'
import Link from 'next/link'
import { Mail, HelpCircle, MessageSquare, Brain, FileQuestion, Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Soporte | SecondBrain',
  description: 'Encuentra respuestas a preguntas frecuentes o contacta con nuestro equipo de soporte.',
}

export default function SoportePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative">
      <AnimatedBackground />
      <Header />

      {/* Hero */}
      <section className="pt-28 sm:pt-36 lg:pt-40 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 mb-6">
            <HelpCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Centro de <span className="liquid-gradient-text">Soporte</span>
          </h1>
          <p className="text-gray-300 text-lg max-w-3xl mx-auto">
            Encuentra respuestas rápidas o contacta con nuestro equipo. Estamos aquí para ayudarte.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
          <div className="glass rounded-2xl p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-4">
              <FileQuestion className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl lg:text-2xl font-semibold text-white">Preguntas Frecuentes</h2>
            </div>
            <ul className="text-gray-300 space-y-3 list-disc list-inside">
              <li>
                <strong className="text-white">¿Cómo creo una cuenta?</strong>
                <div className="text-gray-400">Regístrate y completa tu perfil. Estarás listo en 2 minutos.</div>
              </li>
              <li>
                <strong className="text-white">¿Puedo exportar mis datos?</strong>
                <div className="text-gray-400">Sí. Escríbenos y te ayudamos a exportarlos de forma segura.</div>
              </li>
              <li>
                <strong className="text-white">¿Cómo cancelo mi suscripción?</strong>
                <div className="text-gray-400">Desde Configuración → Mi Suscripción puedes cancelar cuando quieras.</div>
              </li>
            </ul>
          </div>

          <div className="liquid-card rounded-2xl p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl lg:text-2xl font-semibold text-white">Contacto Directo</h2>
            </div>
            <p className="text-gray-300 mb-4">
              Si no encuentras tu respuesta, escríbenos:
            </p>
            <p className="text-purple-300 mb-2">
              <a href="mailto:hello@secondbrainapp.com" className="underline hover:text-purple-200">hello@secondbrainapp.com</a>
            </p>
            <p className="text-gray-400 text-sm">Tiempo de respuesta habitual: 24-48h</p>
          </div>

          <div className="liquid-card rounded-2xl p-6 lg:p-8 md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl lg:text-2xl font-semibold text-white">Estado del Servicio</h2>
            </div>
            <p className="text-gray-300">
              Todo funciona con normalidad. Si detectamos incidencias, las comunicaremos por este canal y por email.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <CtaSection />

      {/* Footer */}
      <footer className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2">
              <Brain className="w-6 h-6 text-purple-400" />
              <span className="text-lg font-semibold text-white">SecondBrain</span>
            </div>
            <div className="flex space-x-6 text-gray-400 text-sm sm:text-base">
              <Link href="/privacidad" className="hover:text-white transition-colors">Privacidad</Link>
              <Link href="/terminos" className="hover:text-white transition-colors">Términos</Link>
              <Link href="/soporte" className="hover:text-white transition-colors">Soporte</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400 text-sm">
            <p>&copy; 2025 SecondBrain. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
