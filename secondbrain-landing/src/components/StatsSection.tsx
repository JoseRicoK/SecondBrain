'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface StatProps {
  number: number;
  label: string;
  suffix?: string;
  duration?: number;
}

function AnimatedStat({ number, label, suffix = '', duration = 2 }: StatProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      
      setCount(Math.floor(progress * number));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [number, duration]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="text-center flex flex-col items-center justify-center min-h-[160px] w-full"
    >
      <motion.div
        className="font-bold liquid-gradient-text mb-3 text-center w-full"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        {count.toLocaleString()}{suffix}
      </motion.div>
      <div className="text-gray-300 text-sm font-medium text-center">
        {label}
      </div>
    </motion.div>
  );
}

export default function StatsSection() {
  const stats = [
    { number: 10000, label: "Usuarios Activos", suffix: "+" },
    { number: 250000, label: "Entradas Creadas", suffix: "+" },
    { number: 500000, label: "Palabras Escritas", suffix: "+" },
    { number: 99, label: "Satisfacción", suffix: "%" }
  ];

  return (
    <section className="py-16 sm:py-20 lg:py-24 px-6 sm:px-8 lg:px-8 bg-gradient-to-b from-transparent via-slate-900/30 to-transparent">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12 lg:mb-16"
        >
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-white mb-4 lg:mb-6">
            Números que <span className="liquid-gradient-text">Hablan</span>
          </h2>
          <p className="text-lg sm:text-xl lg:text-2xl text-gray-300 max-w-3xl mx-auto">
            Miles de personas ya confían en SecondBrain para documentar su vida
          </p>
        </motion.div>

        <div className="liquid-stats-card p-6 lg:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, index) => (
              <AnimatedStat
                key={index}
                number={stat.number}
                label={stat.label}
                suffix={stat.suffix}
                duration={2 + index * 0.3}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
