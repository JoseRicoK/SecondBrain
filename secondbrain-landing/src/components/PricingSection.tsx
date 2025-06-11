'use client';

import { motion } from 'framer-motion';
import { Check, X, Zap, Crown, Heart } from 'lucide-react';
import Link from 'next/link';

export default function PricingSection() {
  const plans = [
    {
      name: "Básico",
      price: "4.99",
      description: "Perfecto para empezar tu viaje",
      icon: Heart,
      color: "from-green-500 to-emerald-500",
      features: [
        { text: "Hasta 100 entradas por mes", included: true },
        { text: "Grabación de voz básica", included: true },
        { text: "Chat personal básico", included: true },
        { text: "Navegación por fechas", included: true },
        { text: "Chats individuales por persona", included: false },
        { text: "Transcripción ilimitada", included: false },
        { text: "Estilización con IA", included: false },
        { text: "Análisis avanzado", included: false }
      ],
      cta: "Comenzar Básico",
      href: "https://app.secondbrain.com/signup",
      popular: false
    },
    {
      name: "Pro",
      price: "9.99",
      description: "Para usuarios serios sobre su crecimiento",
      icon: Zap,
      color: "from-purple-500 to-pink-500",
      features: [
        { text: "Entradas ilimitadas", included: true },
        { text: "Grabación de voz avanzada", included: true },
        { text: "Chat personal ilimitado", included: true },
        { text: "Navegación por fechas", included: true },
        { text: "Chats individuales por persona", included: true },
        { text: "Transcripción ilimitada", included: true },
        { text: "Estilización con IA", included: true },
        { text: "Análisis avanzado", included: false }
      ],
      cta: "Comenzar Pro",
      href: "https://app.secondbrain.com/signup?plan=pro",
      popular: true
    },
    {
      name: "Elite",
      price: "19.99",
      description: "Para profesionales y equipos",
      icon: Crown,
      color: "from-orange-500 to-red-500",
      features: [
        { text: "Todo del plan Pro", included: true },
        { text: "Análisis avanzado con IA", included: true },
        { text: "Reportes personalizados", included: true },
        { text: "Integraciones API", included: true },
        { text: "Soporte prioritario", included: true },
        { text: "Backup automático", included: true },
        { text: "Colaboración en equipo", included: true },
        { text: "Personalización avanzada", included: true }
      ],
      cta: "Comenzar Elite",
      href: "https://app.secondbrain.com/signup?plan=elite",
      popular: false
    }
  ];

  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 liquid-gradient-text">
            Planes que se adaptan a tu ritmo
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Planes flexibles que se adaptan a tus necesidades. Todas las funciones esenciales incluidas.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              className={`relative liquid-card liquid-float rounded-3xl p-8 ${
                plan.popular 
                  ? 'ring-2 ring-purple-500 transform scale-105' 
                  : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Más Popular
                  </div>
                </div>
              )}

              <div className="text-center mb-8">
                <div className={`w-16 h-16 bg-gradient-to-r ${plan.color} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                  <plan.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-gray-300 mb-4">{plan.description}</p>
                <div className="flex items-baseline justify-center">
                  <span className="text-4xl font-bold text-white">${plan.price}</span>
                  <span className="text-gray-400 ml-2">/mes</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center">
                    {feature.included ? (
                      <Check className="w-5 h-5 text-green-400 mr-3 flex-shrink-0" />
                    ) : (
                      <X className="w-5 h-5 text-gray-500 mr-3 flex-shrink-0" />
                    )}
                    <span className={`${
                      feature.included ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 text-center block ${
                  plan.popular
                    ? 'liquid-button bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                    : 'liquid-glass border border-gray-600 text-gray-300 hover:bg-gray-600 hover:text-white'
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-center mt-12"
        >
          <p className="text-gray-400 mb-4">
            ¿Necesitas algo más específico? Hablemos.
          </p>
          <Link
            href="mailto:support@secondbrain.com"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            Contactar para plan empresarial →
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
