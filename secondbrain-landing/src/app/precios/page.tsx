'use client';

import { motion } from 'framer-motion';
import { Brain, ArrowLeft } from 'lucide-react';
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

      {/* Hero Section */}
      <section className="pt-28 sm:pt-32 pb-4 sm:pb-6 px-3 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="container-spacing relative z-10">
          <div className="text-center space-y-4">
            {/* Back Button */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="flex justify-center sm:justify-start"
            >
              <Link
                href="/"
                className="inline-flex items-center text-gray-300 hover:text-white transition-colors duration-300 text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/10 backdrop-blur-sm border border-white/10"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al inicio
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* CTA Section */}
      <CtaSection />

      {/* Footer */}
      <footer className="section-spacing border-t border-gray-800">
        <div className="container-spacing">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2">
              <Brain className="w-6 h-6 text-purple-400" />
              <span className="text-lg font-semibold text-white">SecondBrain</span>
            </div>
            <div className="flex space-x-6 text-gray-400 text-sm sm:text-base">
              <Link href="#" className="hover:text-white transition-colors">
                Privacidad
              </Link>
              <Link href="#" className="hover:text-white transition-colors">
                Términos
              </Link>
              <Link href="#" className="hover:text-white transition-colors">
                Soporte
              </Link>
            </div>
          </div>
          <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-gray-800 text-center text-gray-400 text-sm">
            <p>&copy; 2025 SecondBrain. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
