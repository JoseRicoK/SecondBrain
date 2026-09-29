'use client';

import { Brain } from 'lucide-react';
import Link from 'next/link';
import Header from '../../components/Header';
import PricingSection from '../../components/PricingSection';
import AnimatedBackground from '../../components/AnimatedBackground';
import CtaSection from '../../components/CtaSection';

export default function PreciosPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative">
      {/* Animated Background */}
      <AnimatedBackground />
      
      {/* Navigation */}
      <Header />

      {/* Pricing Section */}
      <div className="pt-28 sm:pt-36 lg:pt-40">
        <PricingSection />
      </div>

      {/* CTA Section */}
      <CtaSection />

      {/* Footer */}
      <footer className="section-spacing">
        <div className="container-spacing">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2">
              <Brain className="w-6 h-6 text-purple-400" />
              <span className="text-lg font-semibold text-white">SecondBrain</span>
            </div>
            <div className="flex space-x-6 text-gray-400 text-sm sm:text-base">
              <Link href="/privacidad" className="hover:text-white transition-colors">
                Privacidad
              </Link>
              <Link href="/terminos" className="hover:text-white transition-colors">
                Términos
              </Link>
              <Link href="/soporte" className="hover:text-white transition-colors">
                Soporte
              </Link>
            </div>
          </div>
          <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-gray-800 text-center text-gray-400 text-sm mx-4 sm:mx-6 lg:mx-8">
            <p>&copy; 2025 SecondBrain. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
