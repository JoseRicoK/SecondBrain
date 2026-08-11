import type { Metadata } from 'next'
import Header from '../../components/Header'
import AnimatedBackground from '../../components/AnimatedBackground'
import CtaSection from '../../components/CtaSection'
import Link from 'next/link'
import { Shield, Lock, FileText, Mail, Brain } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Política de Privacidad | SecondBrain',
  description: 'Conoce cómo protegemos tus datos en SecondBrain: encriptación, control de acceso y transparencia total.',
}

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative">
      <AnimatedBackground />
      <Header />

      {/* Hero */}
      <section className="pt-28 sm:pt-36 lg:pt-40 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 mb-6">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Política de <span className="liquid-gradient-text">Privacidad</span>
          </h1>
          <p className="text-gray-300 text-lg max-w-3xl mx-auto">
            Tu privacidad es prioritaria. Diseñamos SecondBrain con seguridad y control total sobre tus datos.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-5xl mx-auto grid gap-6">
          <div className="glass rounded-2xl p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl lg:text-2xl font-semibold text-white">Principios Clave</h2>
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
              <h2 className="text-xl lg:text-2xl font-semibold text-white">Datos que Recopilamos</h2>
            </div>
            <p className="text-gray-300 mb-3">Solo recopilamos lo necesario para ofrecer la experiencia:</p>
            <ul className="text-gray-300 space-y-2 list-disc list-inside">
              <li>Email y nombre para tu cuenta</li>
              <li>Entradas del diario y archivos que subas</li>
              <li>Métricas de uso para mejorar el producto</li>
            </ul>
          </div>

          <div className="glass rounded-2xl p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl lg:text-2xl font-semibold text-white">Cómo Protegemos tus Datos</h2>
            </div>
            <ul className="text-gray-300 space-y-2 list-disc list-inside">
              <li>Infraestructura segura y copias de seguridad</li>
              <li>Acceso restringido y monitorización</li>
              <li>Procesamiento con IA bajo estrictas políticas de privacidad</li>
            </ul>
          </div>

          <div className="liquid-card rounded-2xl p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl lg:text-2xl font-semibold text-white">Contacto</h2>
            </div>
            <p className="text-gray-300">
              ¿Tienes dudas o quieres ejercer tus derechos? Escríbenos a{' '}
              <a href="mailto:hello@secondbrainapp.com" className="text-purple-300 hover:text-purple-200 underline">hello@secondbrainapp.com</a>.
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
