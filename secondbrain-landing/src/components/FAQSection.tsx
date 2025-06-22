'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export const faqs = [
  {
    question: "¿Cómo funciona la IA conversacional de SecondBrain?",
    answer:
      "Nuestra IA analiza tus entradas de diario para entender tus patrones, emociones y experiencias. Luego puedes conversar con ella sobre tus pensamientos, obtener insights personalizados y descubrir conexiones que quizás no habías notado. Es como tener un terapeuta personal que conoce tu historia completa.",
  },
  {
    question: "¿Mis datos están seguros y privados?",
    answer:
      "Absolutamente. Utilizamos encriptación de nivel empresarial, autenticación segura con Google, y almacenamos tus datos en Supabase con las mejores prácticas de seguridad. Tus pensamientos y reflexiones son completamente privados y nunca compartiremos tu información con terceros.",
  },
  {
    question: "¿Qué hace especial la función de chat por persona?",
    answer:
      "Esta función te permite crear conversaciones específicas con la IA sobre cada persona importante en tu vida. La IA mantiene el contexto de tus relaciones, analiza patrones de interacción y te ayuda a entender mejor tus dinámicas relacionales. Es perfecta para mejorar la comunicación y resolver conflictos.",
  },
  {
    question: "¿Qué tan precisa es la transcripción de voz?",
    answer:
      "Utilizamos la tecnología de transcripción más avanzada de OpenAI, que ofrece una precisión del 95%+ en español. Además, el sistema mejora continuamente y puede manejar diferentes acentos y velocidades de habla. También permite editar las transcripciones si es necesario.",
  },
  {
    question: "¿Puedo usar SecondBrain en móvil y desktop?",
    answer:
      "Sí, SecondBrain está completamente optimizado para todos los dispositivos. Funciona perfectamente en iPhone, iPad, Android y desktop. Todos tus datos se sincronizan automáticamente entre dispositivos para que puedas escribir desde cualquier lugar.",
  },
  {
    question: "¿Qué incluye la estilización con IA?",
    answer:
      "La IA puede mejorar tu escritura corrigiendo gramática, mejorando la fluidez y claridad, pero manteniendo tu voz personal única. No cambia el significado de tus pensamientos, solo los hace más legibles y expresivos. Es opcional y siempre puedes ver el texto original.",
  },
  {
    question: "¿Hay límite en las entradas o grabaciones?",
    answer:
      "En el plan gratuito hay límites modestos para que pruebes la plataforma. Los planes pagos ofrecen uso ilimitado en todas las funciones. Incluso con límites, la mayoría de usuarios encuentran que el plan gratuito es más que suficiente para empezar.",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <HelpCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 liquid-gradient-text">
            Preguntas Frecuentes
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Todo lo que necesitas saber sobre SecondBrain
          </p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              className="liquid-card rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-6 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <h3 className="text-lg font-semibold text-white pr-4">
                  {faq.question}
                </h3>
                <motion.div
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex-shrink-0"
                >
                  <ChevronDown className="w-6 h-6 text-purple-400" />
                </motion.div>
              </button>
              
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6">
                      <p className="text-gray-300 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
            ¿No encuentras la respuesta que buscas?
          </p>
          <a
            href="mailto:support@secondbrainapp.com"
            className="text-purple-400 hover:text-purple-300 transition-colors font-medium"
          >
            Contáctanos directamente →
          </a>
        </motion.div>
      </div>
    </section>
  );
}
