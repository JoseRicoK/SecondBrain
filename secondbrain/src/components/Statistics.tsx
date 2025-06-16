'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { FiTrendingUp, FiUsers, FiRefreshCw, FiBarChart, FiCalendar, FiHeart, FiChevronDown, FiChevronUp } from 'react-icons/fi';
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
  neutral: number;
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
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<StatisticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllPeople, setShowAllPeople] = useState(false);
  const [moodPeriod, setMoodPeriod] = useState<'week' | 'month' | 'year'>('week');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [loadingSection, setLoadingSection] = useState<string | null>(null);

  // Cache keys para localStorage
  const getCacheKey = (userId: string, section: string, period?: string) => {
    const key = `statistics_${userId}_${section}`;
    return period ? `${key}_${period}` : key;
  };

  // Función para verificar si el cache es válido (30 minutos para resumen/cita, 5 minutos para people/mood)
  const isCacheValid = (cacheTime: number, section: string) => {
    const maxAge = ['summary', 'quote'].includes(section) ? 30 * 60 * 1000 : 5 * 60 * 1000; // 30min vs 5min
    return Date.now() - cacheTime < maxAge;
  };

  // Función para obtener datos del cache
  const getCachedData = (section: string, period?: string) => {
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
  };

  // Función para guardar datos en cache
  const setCachedData = (section: string, data: any, period?: string) => {
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
  };

  const loadStatistics = useCallback(async () => {
    if (!user?.uid) return;
    
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
        setCachedData('mood', moodData, moodPeriod);
      }

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
  }, [user, moodPeriod, getCachedData, setCachedData]);

  const updateSection = useCallback(async (section: 'summary' | 'quote' | 'people' | 'mood') => {
    if (!user?.uid) return;
    
    setLoadingSection(section);
    setError(null);
    
    try {
      const token = await user.getIdToken();
      
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
  }, [user, moodPeriod, getCacheKey, setCachedData]);

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
      (window as any).clearStatisticsCache = clearCache;
    }
  }, [clearCache]);

  const displayedPeople = showAllPeople ? data?.topPeople || [] : (data?.topPeople || []).slice(0, 5);

  const getProgressBarStyle = (percentage: number, color: string) => ({
    '--bar-width': `${Math.min(100, Math.max(0, percentage))}%`,
    '--bar-color': color,
  } as React.CSSProperties);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
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
              {/* Gráfico simple de barras */}
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="bg-red-50 rounded-xl p-4">
                      <div className="text-2xl font-bold text-red-600 mb-1">
                        {data?.moodData?.[0]?.stress || 0}%
                      </div>
                      <div className="text-sm text-red-700">Estrés</div>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="bg-green-50 rounded-xl p-4">
                      <div className="text-2xl font-bold text-green-600 mb-1">
                        {data?.moodData?.[0]?.happiness || 0}%
                      </div>
                      <div className="text-sm text-green-700">Felicidad</div>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="text-2xl font-bold text-gray-600 mb-1">
                        {data?.moodData?.[0]?.neutral || 0}%
                      </div>
                      <div className="text-sm text-gray-700">Neutral</div>
                    </div>
                  </div>
                </div>

                {/* Barras de progreso */}
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-red-700">Estrés</span>
                      <span className="text-red-600 font-medium">{data?.moodData?.[0]?.stress || 0}%</span>
                    </div>
                    <div className="w-full bg-red-100 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${styles.progressBar}`}
                        style={getProgressBarStyle(data?.moodData?.[0]?.stress || 0, 'rgb(239, 68, 68)')}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-green-700">Felicidad</span>
                      <span className="text-green-600 font-medium">{data?.moodData?.[0]?.happiness || 0}%</span>
                    </div>
                    <div className="w-full bg-green-100 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${styles.progressBar}`}
                        style={getProgressBarStyle(data?.moodData?.[0]?.happiness || 0, 'rgb(34, 197, 94)')}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">Neutral</span>
                      <span className="text-gray-600 font-medium">{data?.moodData?.[0]?.neutral || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${styles.progressBar}`}
                        style={getProgressBarStyle(data?.moodData?.[0]?.neutral || 0, 'rgb(156, 163, 175)')}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
