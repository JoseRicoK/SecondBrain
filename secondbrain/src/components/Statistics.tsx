'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, ComposedChart } from 'recharts';
import { FiTrendingUp, FiUsers, FiRefreshCw, FiBarChart, FiCalendar, FiHeart, FiChevronDown, FiChevronUp, FiLock } from 'react-icons/fi';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import styles from './Statistics.module.css';

interface PersonMention {
  name: string;
  count: number;
}

interface MoodData {
  date: string;
  stress: number;
  happiness: number;
  tranquility: number;
  sadness: number;
}

interface StatisticsData {
  weekSummary: string;
  instagramQuote: string;
  topPeople: PersonMention[];
  moodData: MoodData[];
}

interface StatisticsProps {
  // userId no se usa actualmente pero se mantiene para compatibilidad futura
  userId: string;
}

export default function Statistics(props: StatisticsProps) {
  // userId no se usa actualmente pero se mantiene para compatibilidad futura
  const { } = props;
  const { user } = useAuth();
  const { 
    currentPlan, 
    planLimits, 
    monthlyUsage, 
    checkCanAccessStatistics,
    refreshMonthlyUsage 
  } = useSubscription();
  
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<StatisticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllPeople, setShowAllPeople] = useState(false);
  const [moodPeriod, setMoodPeriod] = useState<'week' | 'month' | 'year'>('week');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [loadingSection, setLoadingSection] = useState<string | null>(null);
  const [accessBlocked, setAccessBlocked] = useState(false);

  // Cache keys para localStorage
  const getCacheKey = useCallback((userId: string, section: string, period?: string) => {
    const key = `statistics_${userId}_${section}`;
    return period ? `${key}_${period}` : key;
  }, []);

  // Función para verificar si el cache es válido (30 minutos para resumen/cita, 5 minutos para people/mood)
  const isCacheValid = useCallback((cacheTime: number, section: string) => {
    const maxAge = ['summary', 'quote'].includes(section) ? 30 * 60 * 1000 : 5 * 60 * 1000; // 30min vs 5min
    return Date.now() - cacheTime < maxAge;
  }, []);

  // Función para obtener datos del cache
  const getCachedData = useCallback((section: string, period?: string) => {
    try {
      const cacheKey = getCacheKey(user?.uid || '', section, period);
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const { data: cachedData, timestamp } = JSON.parse(cached);
      if (isCacheValid(timestamp, section)) {
        console.log(`📦 [Statistics] Cache hit para ${section}${period ? ` (${period})` : ''}`);
        return cachedData;
      } else {
        console.log(`⏰ [Statistics] Cache expirado para ${section}${period ? ` (${period})` : ''}`);
        localStorage.removeItem(cacheKey);
        return null;
      }
    } catch (error) {
      console.error('Error al leer cache:', error);
      return null;
    }
  }, [user?.uid, getCacheKey, isCacheValid]);

  // Función para guardar datos en cache
  const setCachedData = useCallback((section: string, data: StatisticsData | Partial<StatisticsData>, period?: string) => {
    try {
      const cacheKey = getCacheKey(user?.uid || '', section, period);
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log(`💾 [Statistics] Datos guardados en cache para ${section}${period ? ` (${period})` : ''}`);
    } catch (error) {
      console.error('Error al guardar cache:', error);
    }
  }, [user?.uid, getCacheKey]);

  const loadStatistics = useCallback(async () => {
    if (!user?.uid || accessBlocked) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const token = await user.getIdToken();
      
      // Intentar cargar desde cache primero
      const cachedSummary = getCachedData('summary');
      const cachedQuote = getCachedData('quote');
      const cachedPeople = getCachedData('people');
      const cachedMood = getCachedData('mood', moodPeriod);

      // Si tenemos todos los datos en cache, usarlos
      if (cachedSummary && cachedQuote && cachedPeople && cachedMood) {
        console.log('🚀 [Statistics] Cargando todas las secciones desde cache');
        setData({
          weekSummary: cachedSummary.weekSummary,
          instagramQuote: cachedQuote.instagramQuote,
          topPeople: cachedPeople.topPeople,
          moodData: cachedMood.moodData
        });
        setLastUpdate(new Date());
        setIsLoading(false);
        return;
      }

      // Verificar acceso antes de hacer llamadas a la API
      console.log('🔒 [Statistics] Verificando acceso antes de cargar datos...');
      const accessResponse = await fetch('/api/statistics/access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: user.uid }),
      });

      if (accessResponse.status === 429) {
        const errorData = await accessResponse.json();
        if (errorData.code === 'STATISTICS_LIMIT_EXCEEDED') {
          setAccessBlocked(true);
          setError('Has alcanzado el límite de accesos a estadísticas para este mes.');
          setIsLoading(false);
          return;
        }
      }

      if (!accessResponse.ok) {
        throw new Error('Error al verificar acceso a estadísticas');
      }

      // Si no tenemos todo en cache, cargar lo que falte
      console.log('🌐 [Statistics] Cargando datos desde API...');
      const requests = [];
      
      if (!cachedSummary) {
        requests.push(fetch('/api/statistics/summary', {
          headers: { Authorization: `Bearer ${token}` }
        }));
      }
      
      if (!cachedQuote) {
        requests.push(fetch('/api/statistics/quote', {
          headers: { Authorization: `Bearer ${token}` }
        }));
      }
      
      if (!cachedPeople) {
        requests.push(fetch('/api/statistics/people', {
          headers: { Authorization: `Bearer ${token}` }
        }));
      }
      
      if (!cachedMood) {
        requests.push(fetch(`/api/statistics/mood?moodPeriod=${moodPeriod}`, {
          headers: { Authorization: `Bearer ${token}` }
        }));
      }

      const responses = await Promise.all(requests);
      
      // Verificar que todas las respuestas sean exitosas
      for (const response of responses) {
        if (!response.ok) {
          throw new Error('Error al cargar estadísticas');
        }
      }

      const responseData = await Promise.all(responses.map(r => r.json()));
      
      // Procesar respuestas y actualizar cache
      let summaryData = cachedSummary;
      let quoteData = cachedQuote;
      let peopleData = cachedPeople;
      let moodData = cachedMood;
      
      let responseIndex = 0;
      
      if (!cachedSummary) {
        summaryData = responseData[responseIndex++];
        setCachedData('summary', summaryData);
      }
      
      if (!cachedQuote) {
        quoteData = responseData[responseIndex++];
        setCachedData('quote', quoteData);
      }
      
      if (!cachedPeople) {
        peopleData = responseData[responseIndex++];
        setCachedData('people', peopleData);
      }
      
      if (!cachedMood) {
        moodData = responseData[responseIndex++];
        console.log('🔍 [Statistics Frontend] Datos de mood recibidos de API:', JSON.stringify(moodData, null, 2));
        setCachedData('mood', moodData, moodPeriod);
      }

      console.log('🔍 [Statistics Frontend] Datos finales para setData:', {
        weekSummary: summaryData?.weekSummary,
        instagramQuote: quoteData?.instagramQuote,
        topPeople: peopleData?.topPeople,
        moodData: moodData?.moodData
      });

      setData({
        weekSummary: summaryData.weekSummary,
        instagramQuote: quoteData.instagramQuote,
        topPeople: peopleData.topPeople,
        moodData: moodData.moodData
      });
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
      setError('Error al cargar las estadísticas');
    } finally {
      setIsLoading(false);
    }
  }, [user, moodPeriod, getCachedData, setCachedData, accessBlocked]);

  const updateSection = useCallback(async (section: 'summary' | 'quote' | 'people' | 'mood') => {
    if (!user?.uid || accessBlocked) return;
    
    setLoadingSection(section);
    setError(null);
    
    try {
      const token = await user.getIdToken();
      
      // Verificar acceso antes de actualizar sección
      const accessResponse = await fetch('/api/statistics/access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: user.uid }),
      });

      if (accessResponse.status === 429) {
        const errorData = await accessResponse.json();
        if (errorData.code === 'STATISTICS_LIMIT_EXCEEDED') {
          setAccessBlocked(true);
          setError('Has alcanzado el límite de accesos a estadísticas para este mes.');
          return;
        }
      }

      if (!accessResponse.ok) {
        throw new Error('Error al verificar acceso a estadísticas');
      }
      
      // Invalidar cache de la sección específica
      const cacheKey = getCacheKey(user.uid, section, section === 'mood' ? moodPeriod : undefined);
      localStorage.removeItem(cacheKey);
      console.log(`🗑️ [Statistics] Cache invalidado para ${section}`);
      
      let url = '';
      switch (section) {
        case 'summary':
          url = '/api/statistics/summary';
          break;
        case 'quote':
          url = '/api/statistics/quote';
          break;
        case 'people':
          url = '/api/statistics/people';
          break;
        case 'mood':
          url = `/api/statistics/mood?moodPeriod=${moodPeriod}`;
          break;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Error al actualizar ${section}`);
      }

      const newData = await response.json();
      
      // Guardar en cache
      setCachedData(section, newData, section === 'mood' ? moodPeriod : undefined);
      
      // Actualizar solo la sección específica en el estado
      setData(prevData => {
        if (!prevData) return newData;
        
        return {
          ...prevData,
          ...(section === 'summary' && { weekSummary: newData.weekSummary }),
          ...(section === 'quote' && { instagramQuote: newData.instagramQuote }),
          ...(section === 'people' && { topPeople: newData.topPeople }),
          ...(section === 'mood' && { moodData: newData.moodData }),
        };
      });
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error(`Error al actualizar ${section}:`, error);
      setError(`Error al actualizar ${section}`);
    } finally {
      setLoadingSection(null);
    }
  }, [user, moodPeriod, getCacheKey, setCachedData, accessBlocked]);

  useEffect(() => {
    if (user?.uid) {
      loadStatistics();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  useEffect(() => {
    if (user?.uid && data) {
      updateSection('mood');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moodPeriod]);

  const formatPeriodText = () => {
    const now = new Date();
    switch (moodPeriod) {
      case 'week':
        return `Semana del ${format(startOfWeek(now, { locale: es }), "d MMM", { locale: es })} al ${format(endOfWeek(now, { locale: es }), "d MMM", { locale: es })}`;
      case 'month':
        return format(now, "MMMM yyyy", { locale: es });
      case 'year':
        return format(now, "yyyy", { locale: es });
    }
  };

  // Función para limpiar cache manualmente (útil para llamar desde otros componentes)
  const clearCache = useCallback(() => {
    if (!user?.uid) return;
    
    const sections = ['summary', 'quote', 'people'];
    const periods = ['week', 'month', 'year'];
    
    sections.forEach(section => {
      const key = getCacheKey(user.uid, section);
      localStorage.removeItem(key);
    });
    
    periods.forEach(period => {
      const key = getCacheKey(user.uid, 'mood', period);
      localStorage.removeItem(key);
    });
    
    console.log('🧹 [Statistics] Cache completamente limpiado');
  }, [user?.uid, getCacheKey]);

  // Hacer disponible la función clearCache globalmente si es necesario
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as Window & typeof globalThis & { clearStatisticsCache?: () => void }).clearStatisticsCache = clearCache;
    }
  }, [clearCache]);

  const displayedPeople = showAllPeople ? data?.topPeople || [] : (data?.topPeople || []).slice(0, 5);

  const getProgressBarStyle = (percentage: number, color: string) => ({
    '--bar-width': `${Math.min(100, Math.max(0, percentage))}%`,
    '--bar-color': color,
  } as React.CSSProperties);

  const generateInstagramStoryImage = (quote: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        reject(new Error('Canvas API not available in server environment'));
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = 1080;
      canvas.height = 1920;

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#3B82F6');
      gradient.addColorStop(1, '#1E40AF');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = Math.random() * 3 + 1;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const maxWidth = canvas.width - 120;
      const lineHeight = 80;
      const fontSize = 64;
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

      const wrapText = (text: string, maxWidth: number) => {
        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
          const word = words[i];
          const width = ctx.measureText(currentLine + ' ' + word).width;
          if (width < maxWidth) {
            currentLine += ' ' + word;
          } else {
            lines.push(currentLine);
            currentLine = word;
          }
        }
        lines.push(currentLine);
        return lines;
      };

      const lines = wrapText(`"${quote}"`, maxWidth);
      const totalTextHeight = lines.length * lineHeight;
      const startY = (canvas.height - totalTextHeight) / 2;

      lines.forEach((line, index) => {
        ctx.fillText(line, canvas.width / 2, startY + (index * lineHeight));
      });

      ctx.font = '32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillText('SecondBrain', canvas.width / 2, canvas.height - 100);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to generate image'));
        }
      }, 'image/png');
    });
  };

  const handleShareQuote = async () => {
    if (!data?.instagramQuote) return;
    
    if (typeof window === 'undefined') {
      console.warn('Share functionality not available in server environment');
      return;
    }

    try {
      const imageBlob = await generateInstagramStoryImage(data.instagramQuote);
      
      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ files: [new File([imageBlob], 'quote.png', { type: 'image/png' })] })) {
        const file = new File([imageBlob], 'instagram-story-quote.png', { type: 'image/png' });
        await navigator.share({
          title: 'Mi cita personal de SecondBrain',
          text: 'Comparto mi cita inspiracional del día',
          files: [file]
        });
      } else {
        const url = URL.createObjectURL(imageBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'instagram-story-quote.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error sharing quote:', error);
      if (typeof window !== 'undefined' && typeof alert !== 'undefined') {
        alert('Error al generar la imagen. Por favor, inténtalo de nuevo.');
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      {/* Verificar si el acceso está bloqueado */}
      {accessBlocked ? (
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiLock size={24} className="text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                Límite de estadísticas alcanzado
              </h2>
              <p className="text-slate-600 mb-4">
                {currentPlan === 'free' 
                  ? 'Las estadísticas no están disponibles en el plan gratuito.'
                  : `Has alcanzado el límite de ${planLimits.statisticsAccess} accesos a estadísticas para este mes.`
                }
              </p>
              {monthlyUsage && (
                <p className="text-sm text-slate-500 mb-6">
                  Accesos utilizados: {monthlyUsage.statisticsAccess}/{planLimits.statisticsAccess === -1 ? '∞' : planLimits.statisticsAccess}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                // Navegar a settings - esto se puede mejorar con un router si tienes uno
                const settingsButton = document.querySelector('[data-settings-button]') as HTMLButtonElement;
                if (settingsButton) {
                  settingsButton.click();
                } else {
                  // Fallback: recargar página y mostrar mensaje
                  alert('Ve a Configuración para actualizar tu plan');
                }
              }}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-200 font-medium"
            >
              Actualizar Plan
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-white">
                <FiBarChart size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-800">Estadísticas</h1>
                <p className="text-slate-600">
                  {lastUpdate ? `Última actualización: ${format(lastUpdate, "HH:mm", { locale: es })}` : 'Análisis de tu progreso personal'}
                </p>
              </div>
            </div>
            {/* Mostrar contador de accesos */}
            {monthlyUsage && (
              <div className="mt-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Accesos este mes: {monthlyUsage.statisticsAccess}/{planLimits.statisticsAccess === -1 ? '∞' : planLimits.statisticsAccess}
                </span>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-3 text-gray-600">
                <FiRefreshCw className="animate-spin" size={20} />
                <span>Cargando estadísticas...</span>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={loadStatistics}
                className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
              >
                Reintentar
              </button>
            </div>
          ) : accessBlocked ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">
                Has alcanzado el límite de estadísticas disponibles para tu plan. 
                {currentPlan === 'free' ? ' Actualiza a un plan premium para acceder a más estadísticas.' : ' Intenta más tarde.'}
              </p>
              {currentPlan === 'free' && (
                <a
                  href="/pricing"
                  className="inline-block px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
                >
                  Actualizar a Premium
                </a>
              )}
            </div>
          ) : (
        <div className="space-y-8">
          {/* Resumen de la semana */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 border-b border-purple-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                  <FiTrendingUp size={20} className="text-purple-600" />
                  <span>Resumen de la semana</span>
                </h3>
                <button
                  onClick={() => updateSection('summary')}
                  disabled={loadingSection === 'summary'}
                  className="flex items-center justify-center w-10 h-10 bg-purple-100 hover:bg-purple-200 rounded-xl transition-colors disabled:opacity-50"
                  title={loadingSection === 'summary' ? 'Actualizando...' : 'Actualizar resumen'}
                >
                  <FiRefreshCw size={16} className={`text-purple-600 ${loadingSection === 'summary' ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-700 leading-relaxed">
                {data?.weekSummary || "Cargando resumen de la semana..."}
              </p>
            </div>
          </div>

          {/* Fila para Cita inspiracional y Personas mencionadas en pantallas grandes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Cita inspiracional */}
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 border-b border-blue-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                    <FiHeart size={20} className="text-blue-600" />
                    <span>Cita personal</span>
                  </h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleShareQuote}
                      disabled={loadingSection === 'quote' || !data?.instagramQuote}
                      className="flex items-center justify-center w-10 h-10 bg-blue-100 hover:bg-blue-200 rounded-xl transition-colors disabled:opacity-50"
                      title="Compartir en Instagram Stories"
                    >
                      <FiShare size={16} className="text-blue-600" />
                    </button>
                    <button
                      onClick={() => updateSection('quote')}
                      disabled={loadingSection === 'quote'}
                      className="flex items-center justify-center w-10 h-10 bg-blue-100 hover:bg-blue-200 rounded-xl transition-colors disabled:opacity-50"
                      title={loadingSection === 'quote' ? 'Actualizando...' : 'Actualizar cita'}
                    >
                      <FiRefreshCw size={16} className={`text-blue-600 ${loadingSection === 'quote' ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <blockquote className="text-gray-700 italic text-lg leading-relaxed text-center">
                  &ldquo;{data?.instagramQuote || "Cargando cita personal..."}&rdquo;
                </blockquote>
              </div>
            </div>

            {/* Top personas mencionadas */}
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 border-b border-green-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                    <FiUsers size={20} className="text-green-600" />
                    <span>Personas más mencionadas</span>
                  </h3>
                  <button
                    onClick={() => updateSection('people')}
                    disabled={loadingSection === 'people'}
                    className="flex items-center justify-center w-10 h-10 bg-green-100 hover:bg-green-200 rounded-xl transition-colors disabled:opacity-50"
                    title={loadingSection === 'people' ? 'Actualizando...' : 'Actualizar ranking'}
                  >
                    <FiRefreshCw size={16} className={`text-green-600 ${loadingSection === 'people' ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-3">
                  {displayedPeople.map((person, index) => (
                    <div key={person.name} className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                          index === 0 ? 'bg-yellow-500' : 
                          index === 1 ? 'bg-gray-400' : 
                          index === 2 ? 'bg-yellow-600' : 'bg-green-500'
                        }`}>
                          {index + 1}
                        </div>
                        <span className="font-medium text-gray-900">{person.name}</span>
                      </div>
                      <span className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                        {person.count} menciones
                      </span>
                    </div>
                  ))}
                </div>

                {(data?.topPeople || []).length > 5 && (
                  <button
                    onClick={() => setShowAllPeople(!showAllPeople)}
                    className="w-full mt-4 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors flex items-center justify-center space-x-2"
                  >
                    <span>{showAllPeople ? 'Mostrar menos' : `Ver ${(data?.topPeople || []).length - 5} personas más`}</span>
                    {showAllPeople ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Gráfico de estado de ánimo */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-6 border-b border-orange-100">
              {/* Header con título e ícono */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                  <FiCalendar size={20} className="text-orange-600" />
                  <span>Estado de ánimo - {formatPeriodText()}</span>
                </h3>
                <button
                  onClick={() => updateSection('mood')}
                  disabled={loadingSection === 'mood'}
                  className="flex items-center justify-center w-10 h-10 bg-orange-100 hover:bg-orange-200 rounded-xl transition-colors disabled:opacity-50"
                  title={loadingSection === 'mood' ? 'Actualizando...' : 'Actualizar datos'}
                >
                  <FiRefreshCw size={16} className={`text-orange-600 ${loadingSection === 'mood' ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              {/* Selector de período centrado */}
              <div className="flex justify-center">
                <select
                  value={moodPeriod}
                  onChange={(e) => setMoodPeriod(e.target.value as 'week' | 'month' | 'year')}
                  className="px-3 py-1 bg-white rounded-lg border border-orange-200 text-sm"
                  aria-label="Seleccionar período"
                >
                  <option value="week">Semana</option>
                  <option value="month">Mes</option>
                  <option value="year">Año</option>
                </select>
              </div>
            </div>

            <div className="p-6">
              {/* Dos gráficos en grid responsive */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Gráfico 1: Felicidad vs Tristeza */}
                <div className="bg-gradient-to-br from-yellow-50 to-blue-50 rounded-2xl p-6 border border-yellow-100">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 text-center">
                    Emociones Positivas vs Negativas
                  </h4>
                  
                  {/* Verificar si existen datos de emociones */}
                  {data?.moodData && data.moodData.length > 0 ? (
                    <>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart
                            data={data.moodData}
                            margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="colorHappiness" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1} />
                              </linearGradient>
                              <linearGradient id="colorSadness" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                            <XAxis 
                              dataKey="date"
                              tickFormatter={(value) => {
                                const date = new Date(value);
                                return date.getDate().toString();
                              }}
                              tick={{ fontSize: 12 }}
                              axisLine={{ stroke: '#E5E7EB', strokeWidth: 1 }}
                              tickLine={false}
                            />
                            <YAxis 
                              domain={[0, 100]}
                              tick={{ fontSize: 12 }}
                              axisLine={false}
                              tickLine={false}
                              tickCount={5}
                              tickFormatter={(value) => `${value}%`}
                            />
                            <Tooltip
                              formatter={(value, name) => {
                                if (name === 'happiness') return [`${value}%`, 'Felicidad'];
                                if (name === 'sadness') return [`${value}%`, 'Tristeza'];
                                return [value, name];
                              }}
                              labelFormatter={(label) => {
                                const date = new Date(label);
                                return format(date, 'd MMM yyyy', { locale: es });
                              }}
                              contentStyle={{
                                borderRadius: '8px',
                                border: '1px solid #E5E7EB',
                                boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)',
                                backgroundColor: 'rgba(255,255,255,0.95)'
                              }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="happiness" 
                              stroke="#22c55e" 
                              fill="url(#colorHappiness)" 
                              strokeWidth={3} 
                              dot={{ r: 4, fill: '#22c55e', stroke: '#22c55e', strokeWidth: 1 }}
                              activeDot={{ r: 6, fill: '#22c55e', stroke: '#ffffff', strokeWidth: 2 }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="sadness" 
                              stroke="#3b82f6" 
                              fill="url(#colorSadness)" 
                              strokeWidth={3}
                              strokeDasharray="5 3" 
                              dot={{ r: 4, fill: '#3b82f6', stroke: '#3b82f6', strokeWidth: 1 }}
                              activeDot={{ r: 6, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 2 }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Leyenda */}
                      <div className="flex justify-around mt-2">
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                            <span className="text-sm font-medium text-green-700">Felicidad</span>
                          </div>
                          <div className="text-xl font-bold text-green-600">
                            {Math.round(data.moodData.reduce((acc, point) => acc + (point.happiness || 0), 0) / data.moodData.length)}%
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                            <span className="text-sm font-medium text-blue-700">Tristeza</span>
                          </div>
                          <div className="text-xl font-bold text-blue-600">
                            {Math.round(data.moodData.reduce((acc, point) => acc + (point.sadness || 0), 0) / data.moodData.length)}%
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                      <FiBarChart size={32} className="mb-2 opacity-50" />
                      <p className="text-sm text-center">
                        No hay datos emocionales para este período.<br />
                        Agrega entradas en tu diario para ver estadísticas.
                      </p>
                    </div>
                  )}
                </div>

                {/* Gráfico 2: Estrés vs Tranquilidad */}
                <div className="bg-gradient-to-br from-red-50 to-green-50 rounded-2xl p-6 border border-red-100">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 text-center">
                    Tensión vs Calma
                  </h4>
                  
                  {/* Verificar si existen datos de emociones */}
                  {data?.moodData && data.moodData.length > 0 ? (
                    <>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart
                            data={data.moodData}
                            margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="colorStress" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                              </linearGradient>
                              <linearGradient id="colorTranquility" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                            <XAxis 
                              dataKey="date"
                              tickFormatter={(value) => {
                                const date = new Date(value);
                                return date.getDate().toString();
                              }}
                              tick={{ fontSize: 12 }}
                              axisLine={{ stroke: '#E5E7EB', strokeWidth: 1 }}
                              tickLine={false}
                            />
                            <YAxis 
                              domain={[0, 100]}
                              tick={{ fontSize: 12 }}
                              axisLine={false}
                              tickLine={false}
                              tickCount={5}
                              tickFormatter={(value) => `${value}%`}
                            />
                            <Tooltip
                              formatter={(value, name) => {
                                if (name === 'stress') return [`${value}%`, 'Tensión'];
                                if (name === 'tranquility') return [`${value}%`, 'Calma'];
                                return [value, name];
                              }}
                              labelFormatter={(label) => {
                                const date = new Date(label);
                                return format(date, 'd MMM yyyy', { locale: es });
                              }}
                              contentStyle={{
                                borderRadius: '8px',
                                border: '1px solid #E5E7EB',
                                boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)',
                                backgroundColor: 'rgba(255,255,255,0.95)'
                              }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="stress" 
                              stroke="#ef4444" 
                              fill="url(#colorStress)" 
                              strokeWidth={3} 
                              dot={{ r: 4, fill: '#ef4444', stroke: '#ef4444', strokeWidth: 1 }}
                              activeDot={{ r: 6, fill: '#ef4444', stroke: '#ffffff', strokeWidth: 2 }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="tranquility" 
                              stroke="#10b981" 
                              fill="url(#colorTranquility)" 
                              strokeWidth={3}
                              strokeDasharray="5 3" 
                              dot={{ r: 4, fill: '#10b981', stroke: '#10b981', strokeWidth: 1 }}
                              activeDot={{ r: 6, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Leyenda */}
                      <div className="flex justify-around mt-2">
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                            <span className="text-sm font-medium text-red-700">Tensión</span>
                          </div>
                          <div className="text-xl font-bold text-red-600">
                            {Math.round(data.moodData.reduce((acc, point) => acc + (point.stress || 0), 0) / data.moodData.length)}%
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                            <span className="text-sm font-medium text-green-700">Calma</span>
                          </div>
                          <div className="text-xl font-bold text-green-600">
                            {Math.round(data.moodData.reduce((acc, point) => acc + (point.tranquility || 0), 0) / data.moodData.length)}%
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                      <FiBarChart size={32} className="mb-2 opacity-50" />
                      <p className="text-sm text-center">
                        No hay datos emocionales para este período.<br />
                        Agrega entradas en tu diario para ver estadísticas.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
          )}
        </>
      )}
    </div>
  );
}
