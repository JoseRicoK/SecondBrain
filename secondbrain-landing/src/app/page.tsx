'use client';

import { motion } from 'framer-motion';
import { 
  Brain,
  MessageCircle, 
  Users, 
  Mic, 
  Calendar, 
  Sparkles, 
  Shield,
  ChevronRight,
  Star,
  Zap,
  Heart,
  Lock,
  Play,
  BarChart3,
  TrendingUp,
  Award,
  Quote,
  PieChart,
  Activity
} from 'lucide-react';
import Link from 'next/link';
import Header from '../components/Header';
import StatsSection from '../components/StatsSection';
import TestimonialsCarousel from '../components/TestimonialsCarousel';
import FAQSection from '../components/FAQSection';
import AnimatedBackground from '../components/AnimatedBackground';
import CtaSection from '../components/CtaSection';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative">
      {/* Animated Background */}
      <AnimatedBackground />
      
      {/* Navigation */}
      <Header />

      {/* Hero Section */}
      <main>
        <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden min-h-screen flex items-center">
          {/* Background Effects */}
          <div className="absolute inset-0" aria-hidden="true">
            <div className="absolute top-20 left-4 w-32 h-32 sm:w-48 sm:h-48 lg:w-72 lg:h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
            <div className="absolute top-40 right-4 w-32 h-32 sm:w-48 sm:h-48 lg:w-72 lg:h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-2s"></div>
            <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 w-32 h-32 sm:w-48 sm:h-48 lg:w-72 lg:h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-4s"></div>
          </div>

          <div className="max-w-7xl mx-auto relative z-10 w-full">
            <header className="text-center space-y-8 lg:space-y-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="space-y-6 lg:space-y-8"
              >
                {/* Badge */}
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 1, delay: 0.2 }}
                  className="flex justify-center"
                >
                  <div className="inline-flex items-center bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full px-4 py-2 lg:px-6 lg:py-3 backdrop-blur-sm border border-purple-500/30">
                    <Sparkles className="w-4 h-4 lg:w-5 lg:h-5 text-purple-400 mr-2" aria-hidden="true" />
                    <span className="text-purple-300 text-sm font-medium">Potenciado por Inteligencia Artificial</span>
                  </div>
                </motion.div>

                {/* Title - Optimizado para SEO */}
                <div className="text-spacing">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-tight">
                    <span itemProp="name">SecondBrain:</span> Tu{' '}
                    <span className="liquid-gradient-text">Diario Personal con IA</span>
                    <br />
                    <motion.span
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, delay: 0.4 }}
                    >
                      Más Inteligente de 2025
                    </motion.span>
                  </h1>
                  
                  {/* Description - Rica en keywords SEO */}
                  <motion.p 
                    className="large-text text-gray-300 max-w-3xl mx-auto mt-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                    itemProp="description"
                  >
                    🧠 Revoluciona tu <strong className="text-white">bienestar mental</strong> y <strong className="text-white">crecimiento personal</strong> con el 
                    <strong className="text-white"> diario personal más avanzado del mundo</strong>. Incluye <strong className="text-white">chat inteligente con IA</strong>, 
                    <strong className="text-white"> grabación y transcripción de voz automática</strong>, <strong className="text-white">análisis de sentimientos</strong>, 
                    <strong className="text-white"> estadísticas de relaciones personales</strong> y mucho más. 
                    <em>Transforma cómo reflexionas sobre tu vida diaria.</em>
                  </motion.p>

                  {/* Beneficios clave para SEO */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.8 }}
                    className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-purple-200"
                  >
                    <span className="bg-purple-500/20 px-3 py-1 rounded-full">✅ 100% Gratuito para empezar</span>
                    <span className="bg-purple-500/20 px-3 py-1 rounded-full">🔒 Privacidad total garantizada</span>
                    <span className="bg-purple-500/20 px-3 py-1 rounded-full">🚀 Sin instalación requerida</span>
                  </motion.div>
                </div>
              </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="flex justify-center items-center"
            >
              <Link
                href="https://app.secondbrainapp.com/signup?plan=free"
                className="w-full sm:w-auto max-w-xs liquid-button text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center group"
              >
                Comenzar Gratis
                <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1 }}
              className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-6 lg:space-x-8 text-gray-400 text-sm"
            >
              <div className="flex items-center">
                <Shield className="w-4 h-4 lg:w-5 lg:h-5 mr-2 text-green-400" />
                <span>100% Seguro</span>
              </div>
              <div className="flex items-center">
                <Zap className="w-4 h-4 lg:w-5 lg:h-5 mr-2 text-yellow-400" />
                <span>Fácil de empezar</span>
              </div>
              <div className="flex items-center">
                <Heart className="w-4 h-4 lg:w-5 lg:h-5 mr-2 text-red-400" />
                <span>+10K usuarios felices</span>
              </div>
            </motion.div>
            </header>
          </div>
        </section>
      </main>

      {/* Key Features Highlight Section */}
      <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent to-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12 lg:mb-16"
          >
            <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-white mb-4 lg:mb-6">
              El Poder de la <span className="liquid-gradient-text">Inteligencia Artificial</span>
            </h2>
            <p className="text-lg sm:text-xl lg:text-2xl text-gray-300 max-w-3xl mx-auto">
              Descubre las principales características que hacen de SecondBrain tu compañero perfecto
            </p>
          </motion.div>
          
          {/* Simplified Key Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-center"
            >
              <div 
                className="liquid-card liquid-float p-6 hover:scale-105 transition-all duration-300"
                style={{ '--random-delay': Math.random() * 10 } as React.CSSProperties}
              >
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Chat Personal con IA</h3>
                <p className="text-gray-300 text-sm">Conversa sobre tus pensamientos y obtén insights personalizados</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-center"
            >
              <div 
                className="liquid-card liquid-float p-6 hover:scale-105 transition-all duration-300"
                style={{ '--random-delay': Math.random() * 10 } as React.CSSProperties}
              >
                <div className="bg-gradient-to-r from-blue-500 to-cyan-500 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Chat por Persona</h3>
                <p className="text-gray-300 text-sm">Análisis individual de cada relación importante en tu vida</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-center"
            >
              <div 
                className="liquid-card liquid-float p-6 hover:scale-105 transition-all duration-300"
                style={{ '--random-delay': Math.random() * 10 } as React.CSSProperties}
              >
                <div className="bg-gradient-to-r from-green-500 to-emerald-500 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Mic className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Grabación de Voz</h3>
                <p className="text-gray-300 text-sm">Transcripción automática con IA que convierte voz en texto</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-center"
            >
              <div 
                className="liquid-card liquid-float p-6 hover:scale-105 transition-all duration-300"
                style={{ '--random-delay': Math.random() * 10 } as React.CSSProperties}
              >
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Navegación Temporal</h3>
                <p className="text-gray-300 text-sm">Viaja a cualquier día de tu vida y revive tus memorias</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12 lg:mb-16"
          >
            <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-white mb-4">
              Funcionalidades <span className="liquid-gradient-text">Revolucionarias</span>
            </h2>
            <p className="text-lg sm:text-xl lg:text-2xl text-gray-300 max-w-3xl mx-auto">
              Descubre cómo SecondBrain transforma tu manera de escribir y recordar
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Chat Personal con IA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="liquid-card liquid-float p-6 lg:p-8 hover:scale-105 transition-all duration-300"
              style={{ '--random-delay': Math.random() * 15 } as React.CSSProperties}
            >
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg lg:text-xl font-semibold text-white mb-3">Chat Personal con IA</h3>
              <p className="text-sm lg:text-base text-gray-300 mb-4">
                Conversa con tu asistente personal sobre tus entradas. Obtén insights, 
                análisis de patrones y consejos personalizados basados en tu historial.
              </p>
              <div className="flex items-center text-purple-400 text-sm">
                <Sparkles className="w-4 h-4 mr-2" />
                Potenciado por OpenAI
              </div>
            </motion.div>

            {/* Chat Individual por Persona */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="liquid-card liquid-float p-6 lg:p-8 hover:scale-105 transition-all duration-300"
              style={{ '--random-delay': Math.random() * 15 } as React.CSSProperties}
            >
              <div className="bg-gradient-to-r from-blue-500 to-cyan-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg lg:text-xl font-semibold text-white mb-3">Chat Individual por Persona</h3>
              <p className="text-sm lg:text-base text-gray-300 mb-4">
                Crea conversaciones específicas con la IA sobre cada persona importante en tu vida. 
                Mantén contexto y análisis únicos para cada relación.
              </p>
              <div className="flex items-center text-blue-400 text-sm">
                <Heart className="w-4 h-4 mr-2" />
                Relaciones Inteligentes
              </div>
            </motion.div>

            {/* Grabación de Voz */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="liquid-card liquid-float p-6 lg:p-8 hover:scale-105 transition-all duration-300"
              style={{ '--random-delay': Math.random() * 15 } as React.CSSProperties}
            >
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Mic className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg lg:text-xl font-semibold text-white mb-3">Grabación de Voz</h3>
              <p className="text-sm lg:text-base text-gray-300 mb-4">
                Graba tus pensamientos al instante. Transcripción automática con IA 
                que convierte tu voz en texto perfecto en segundos.
              </p>
              <div className="flex items-center text-green-400 text-sm">
                <Zap className="w-4 h-4 mr-2" />
                Transcripción Instantánea
              </div>
            </motion.div>

            {/* Estilización con IA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="liquid-card liquid-float p-6 lg:p-8 hover:scale-105 transition-all duration-300"
              style={{ '--random-delay': Math.random() * 15 } as React.CSSProperties}
            >
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg lg:text-xl font-semibold text-white mb-3">Estilización con IA</h3>
              <p className="text-sm lg:text-base text-gray-300 mb-4">
                Mejora automáticamente tus textos manteniendo tu estilo personal. 
                Corrección de gramática y estilo sin perder tu esencia.
              </p>
              <div className="flex items-center text-orange-400 text-sm">
                <Star className="w-4 h-4 mr-2" />
                Mantiene tu Voz
              </div>
            </motion.div>

            {/* Navegación por Fechas */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="liquid-card liquid-float p-6 lg:p-8 hover:scale-105 transition-all duration-300"
              style={{ '--random-delay': Math.random() * 15 } as React.CSSProperties}
            >
              <div className="bg-gradient-to-r from-indigo-500 to-purple-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg lg:text-xl font-semibold text-white mb-3">Navegación Temporal</h3>
              <p className="text-sm lg:text-base text-gray-300 mb-4">
                Viaja a cualquier día de tu vida. Calendario intuitivo para 
                revisar y revivir tus memorias cuando quieras.
              </p>
              <div className="flex items-center text-indigo-400 text-sm">
                <Calendar className="w-4 h-4 mr-2" />
                Máquina del Tiempo Personal
              </div>
            </motion.div>

            {/* Seguridad */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="liquid-card liquid-float p-6 lg:p-8 hover:scale-105 transition-all duration-300"
              style={{ '--random-delay': Math.random() * 15 } as React.CSSProperties}
            >
              <div className="bg-gradient-to-r from-red-500 to-pink-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg lg:text-xl font-semibold text-white mb-3">Máxima Seguridad</h3>
              <p className="text-sm lg:text-base text-gray-300 mb-4">
                Tus pensamientos están protegidos con encriptación de nivel empresarial. 
                Login con Google y datos seguros en Supabase.
              </p>
              <div className="flex items-center text-red-400 text-sm">
                <Lock className="w-4 h-4 mr-2" />
                Encriptación Total
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Advanced Analytics Section */}
      <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
        {/* Background Animation */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-20 h-20 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse"></div>
          <div className="absolute bottom-10 right-10 w-32 h-32 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse delay-2s"></div>
          <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse delay-4s"></div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12 lg:mb-16"
          >
            <div className="inline-flex items-center bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm border border-purple-500/30 rounded-full px-4 py-2 mb-6">
              <BarChart3 className="w-4 h-4 text-purple-400 mr-2" />
              <span className="text-purple-300 text-sm font-medium">Análisis Inteligente</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
              Descubre Patrones en tu
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"> Vida</span>
            </h2>
            <p className="text-lg sm:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              SecondBrain no solo guarda tus pensamientos, los analiza para ofrecerte insights únicos sobre tu bienestar emocional, relaciones y crecimiento personal.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 lg:gap-8">
            {/* Análisis de Emociones */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="glass rounded-2xl p-6 lg:p-8 hover:scale-105 transition-all duration-300 group"
            >
              <div className="bg-gradient-to-r from-rose-500 to-pink-500 w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <PieChart className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Análisis Emocional</h3>
              <p className="text-gray-300 mb-6 leading-relaxed">
                Visualiza tu estado emocional a través del tiempo con gráficos interactivos que muestran tus niveles de felicidad, neutralidad y estrés.
              </p>
              <div className="flex items-center text-rose-400 text-sm font-medium">
                <Activity className="w-4 h-4 mr-2" />
                Seguimiento en tiempo real
              </div>
            </motion.div>

            {/* Resumen Semanal */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="glass rounded-2xl p-6 lg:p-8 hover:scale-105 transition-all duration-300 group"
            >
              <div className="bg-gradient-to-r from-orange-500 to-red-500 w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Resumen Semanal</h3>
              <p className="text-gray-300 mb-6 leading-relaxed">
                Recibe automáticamente insights sobre tu semana: patrones de comportamiento, tendencias emocionales y momentos destacados.
              </p>
              <div className="flex items-center text-orange-400 text-sm font-medium">
                <Sparkles className="w-4 h-4 mr-2" />
                Powered by IA
              </div>
            </motion.div>

            {/* Ranking de Relaciones */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="glass rounded-2xl p-6 lg:p-8 hover:scale-105 transition-all duration-300 group"
            >
              <div className="bg-gradient-to-r from-yellow-500 to-amber-500 w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Award className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Ranking de Personas</h3>
              <p className="text-gray-300 mb-6 leading-relaxed">
                Descubre quiénes son las personas más importantes en tu vida basado en la frecuencia de menciones en tus entradas.
              </p>
              <div className="flex items-center text-yellow-400 text-sm font-medium">
                <Users className="w-4 h-4 mr-2" />
                Análisis de relaciones
              </div>
            </motion.div>

            {/* Citas Inspiracionales */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="glass rounded-2xl p-6 lg:p-8 hover:scale-105 transition-all duration-300 group"
            >
              <div className="bg-gradient-to-r from-teal-500 to-cyan-500 w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Quote className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Citas Personalizadas</h3>
              <p className="text-gray-300 mb-6 leading-relaxed">
                Recibe frases inspiracionales y motivacionales generadas específicamente para tu estado de ánimo y experiencias del día.
              </p>
              <div className="flex items-center text-teal-400 text-sm font-medium">
                <Heart className="w-4 h-4 mr-2" />
                Motivación diaria
              </div>
            </motion.div>
          </div>

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="text-center mt-12 lg:mt-16"
          >
            <div className="glass rounded-3xl p-8 lg:p-12 max-w-4xl mx-auto">
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">
                Conoce tu mente como nunca antes
              </h3>
              <p className="text-gray-300 text-lg mb-8 max-w-2xl mx-auto">
                Combina la potencia de la inteligencia artificial con tus experiencias personales para obtener insights únicos sobre tu bienestar y crecimiento.
              </p>
              <Link
                href="https://app.secondbrainapp.com/signup?plan=free"
                className="inline-flex items-center liquid-button text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 group"
              >
                Explorar mis Estadísticas
                <BarChart3 className="w-5 h-5 ml-2 group-hover:scale-110 transition-transform" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <StatsSection />

      {/* Testimonials Section */}
      <TestimonialsCarousel />

      {/* Pricing CTA Section */}
      <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-slate-900/30 to-transparent">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <div className="liquid-card p-8 md:p-12 max-w-4xl mx-auto">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-white mb-4 lg:mb-6">
                Planes que se adaptan a <span className="liquid-gradient-text">tu ritmo</span>
              </h2>
              <p className="text-lg sm:text-xl lg:text-2xl text-gray-300 mb-8 max-w-2xl mx-auto">
                Planes flexibles que se adaptan a tus necesidades. Todas las funciones 
                esenciales para comenzar tu viaje de autodescubrimiento.
              </p>
              <Link
                href="/precios"
                className="liquid-button inline-flex items-center text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-300 shadow-lg"
              >
                Ver Todos los Planes
                <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <FAQSection />

      {/* CTA Section */}
      <CtaSection />

      {/* Footer */}
      <footer className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-t border-gray-800">
        <div className="max-w-7xl mx-auto">
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
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400 text-sm">
            <p>&copy; 2025 SecondBrain. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
