'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';

const testimonials = [
  {
    name: "María González",
    role: "Escritora y Blogguera",
    avatar: "M",
    text: "SecondBrain ha revolucionado mi proceso creativo. El chat con IA me da ideas increíbles basadas en mis propias reflexiones. Es como tener un editor personal 24/7.",
    stars: 5,
    color: "from-purple-500 to-pink-500"
  },
  {
    name: "Carlos Ruiz",
    role: "Emprendedor Tech",
    avatar: "C",
    text: "La función de grabación de voz es perfecta para capturar ideas sobre la marcha. La transcripción es impecable y me ahorra horas de escritura manual.",
    stars: 5,
    color: "from-blue-500 to-cyan-500"
  },
  {
    name: "Ana Martín",
    role: "Psicóloga Clínica",
    avatar: "A",
    text: "Uso SecondBrain para mi desarrollo personal. Los chats individuales por persona me ayudan a entender mejor mis relaciones y patrones emocionales.",
    stars: 5,
    color: "from-green-500 to-emerald-500"
  },
  {
    name: "Javier López",
    role: "Estudiante de Doctorado",
    avatar: "J",
    text: "Para mi investigación es invaluable. Puedo documentar mis ideas, hacer conexiones y tener conversaciones profundas con la IA sobre mis hallazgos.",
    stars: 5,
    color: "from-orange-500 to-red-500"
  },
  {
    name: "Laura Chen",
    role: "Coach de Vida",
    avatar: "L",
    text: "SecondBrain me ha ayudado a ser más reflexiva y consciente. La función de análisis de patrones es increíble para el autoconocimiento.",
    stars: 5,
    color: "from-indigo-500 to-purple-500"
  }
];

export default function TestimonialsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);

  useEffect(() => {
    if (!isAutoPlay) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlay]);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Lo que dicen nuestros <span className="liquid-gradient-text">usuarios</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Experiencias reales de personas que han transformado su forma de documentar su vida
          </p>
        </motion.div>

        <div 
          className="flex items-center gap-2 sm:gap-4 lg:gap-8"
          onMouseEnter={() => setIsAutoPlay(false)}
          onMouseLeave={() => setIsAutoPlay(true)}
        >
          {/* Left Navigation Button */}
          <button
            onClick={prevTestimonial}
            className="hidden sm:flex flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 carousel-nav-button rounded-full items-center justify-center transition-all duration-300 hover:scale-105"
            title="Testimonio anterior"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>

          {/* Testimonial Content */}
          <div className="flex-1 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 300 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -300 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="liquid-card p-8 md:p-12 relative overflow-hidden"
              >
                {/* Background Pattern */}
                <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
                  <Quote className="w-full h-full text-purple-400" />
                </div>

                <div className="relative z-10">
                  {/* Stars */}
                  <div className="flex justify-center mb-6">
                    {[...Array(testimonials[currentIndex].stars)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <Star className="w-6 h-6 text-yellow-400 fill-current mx-1" />
                      </motion.div>
                    ))}
                  </div>

                  {/* Testimonial Text */}
                  <blockquote className="text-xl md:text-2xl text-gray-200 text-center mb-8 italic leading-relaxed">
                    &ldquo;{testimonials[currentIndex].text}&rdquo;
                  </blockquote>

                  {/* Author Info */}
                  <div className="flex items-center justify-center space-x-4">
                    <motion.div
                      className={`w-16 h-16 bg-gradient-to-r ${testimonials[currentIndex].color} rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg`}
                      whileHover={{ scale: 1.1 }}
                    >
                      {testimonials[currentIndex].avatar}
                    </motion.div>
                    <div>
                      <h4 className="text-xl font-bold text-white">
                        {testimonials[currentIndex].name}
                      </h4>
                      <p className="text-gray-400">
                        {testimonials[currentIndex].role}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right Navigation Button */}
          <button
            onClick={nextTestimonial}
            className="hidden sm:flex flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 carousel-nav-button rounded-full items-center justify-center transition-all duration-300 hover:scale-105"
            title="Siguiente testimonio"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>
        </div>

        {/* Dots Indicator */}
        <div className="flex justify-center mt-8 space-x-2">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              aria-label={`Ir al testimonio ${index + 1}`}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 w-8' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
