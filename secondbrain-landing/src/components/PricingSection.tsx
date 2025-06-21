'use client';

import { motion } from 'framer-motion';
import { Check, X, Zap, Crown, Heart } from 'lucide-react';
import Link from 'next/link';

export default function PricingSection() {
  const plans = [
    {
      name: "Gratuito",
      price: "0",
      description: "Perfecto para empezar tu viaje personal",
      icon: Heart,
      color: "from-gray-500 to-slate-500",
      features: [
        { text: "🎙️ Transcripciones ilimitadas", included: true },
        { text: "💬 5 mensajes de chat personal por mes", included: true },
        { text: "👥 10 mensajes con personas por mes", included: true },
        { text: "📅 Navegación por fechas", included: true },
        { text: "🎨 Estilización básica de texto", included: true },
        { text: "👥 Extracción de personas", included: true },
        { text: "📊 Estadísticas avanzadas", included: false },
        { text: "🎨 Estilización con IA avanzada", included: false }
      ],
      cta: "Comenzar Gratis",
      href: "https://app.secondbrainapp.com/signup?plan=free",
      popular: false
    },
    {
      name: "Pro",
      price: "9.99",
      description: "Para usuarios serios sobre su crecimiento",
      icon: Zap,
      color: "from-purple-500 to-pink-500",
      features: [
        { text: "✨ Todo del plan Gratuito", included: true },
        { text: "💬 30 mensajes de chat personal por mes", included: true },
        { text: "👥 100 mensajes con personas por mes", included: true },
        { text: "🎨 Estilización avanzada con IA", included: true },
        { text: "📊 10 estadísticas avanzadas por mes", included: true },
        { text: "🔍 Análisis inteligente mejorado", included: true },
        { text: "💬 Chat personal ilimitado", included: false },
        { text: "👥 Chat con personas ilimitado", included: false }
      ],
      cta: "Comenzar Pro",
      href: "https://app.secondbrainapp.com/signup?plan=pro",
      popular: true
    },
    {
      name: "Elite",
      price: "19.99",
      description: "Para profesionales que buscan lo mejor",
      icon: Crown,
      color: "from-orange-500 to-red-500",
      features: [
        { text: "⭐ Todo del plan Pro", included: true },
        { text: "💬 100 mensajes de chat personal por mes", included: true },
        { text: "👥 500 mensajes con personas por mes", included: true },
        { text: "📊 Estadísticas avanzadas ilimitadas", included: true },
        { text: "🧠 Análisis profundo con IA", included: true },
        { text: "🏆 Soporte prioritario", included: true },
        { text: "🚀 Funciones experimentales", included: true }
      ],
      cta: "Comenzar Elite",
      href: "https://app.secondbrainapp.com/signup?plan=elite",
      popular: false
    }
  ];

  return (
    <section id="pricing" className="py-8 sm:py-12 lg:py-16 px-4 sm:px-6 lg:px-8" itemScope itemType="https://schema.org/PriceSpecification">
      <div className="max-w-7xl mx-auto">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12 sm:mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4 liquid-gradient-text px-4 leading-tight">
            <span className="block sm:inline">Planes que</span>
            <span className="block sm:inline sm:ml-2">se adaptan a tu ritmo</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-300 max-w-3xl mx-auto px-4" itemProp="description">
            Elige el <strong>plan perfecto</strong> para tu <strong>diario personal con IA</strong>. 
            Desde <strong>completamente gratis</strong> hasta funciones <strong>premium avanzadas</strong>. 
            Todas las características esenciales incluidas para tu <strong>crecimiento personal</strong>.
          </p>
        </motion.header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          {plans.map((plan, index) => (
            <article key={index} className="relative pt-6" itemScope itemType="https://schema.org/Product">
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-20">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg whitespace-nowrap">
                    🔥 Más Popular
                  </div>
                </div>
              )}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                className={`liquid-card liquid-float rounded-3xl p-8 ${
                  plan.popular 
                    ? 'ring-2 ring-purple-500 transform scale-105' 
                    : ''
                }`}
                itemScope 
                itemType="https://schema.org/Offer"
              >

              <div className="text-center mb-8">
                <div className={`w-16 h-16 bg-gradient-to-r ${plan.color} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                  <plan.icon className="w-8 h-8 text-white" aria-hidden="true" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2" itemProp="name">{plan.name}</h2>
                <p className="text-gray-300 mb-4" itemProp="description">{plan.description}</p>
                <div className="flex items-baseline justify-center" itemProp="priceSpecification" itemScope itemType="https://schema.org/PriceSpecification">
                  <span className="text-4xl font-bold text-white">
                    <span itemProp="priceCurrency" content="USD">$</span>
                    <span itemProp="price" content={plan.price}>{plan.price}</span>
                  </span>
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
            </article>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-center mt-8 sm:mt-12 px-4"
        >
          <p className="text-gray-400 mb-4 text-sm sm:text-base">
            ¿Necesitas algo más específico? Hablemos.
          </p>
          <Link
            href="mailto:support@secondbrainapp.com"
            className="text-purple-400 hover:text-purple-300 transition-colors text-sm sm:text-base"
          >
            Contactar para más información →
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
