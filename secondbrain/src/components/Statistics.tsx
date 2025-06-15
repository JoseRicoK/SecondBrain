'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { FiTrendingUp, FiUsers, FiRefreshCw, FiBarChart, FiCalendar, FiHeart, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

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

  const loadStatistics = useCallback(async () => {
    if (!user?.uid) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const token = await user.getIdToken();
      
      // Cargar todas las secciones en paralelo
      const [summaryResponse, quoteResponse, peopleResponse, moodResponse] = await Promise.all([
        fetch('/api/statistics/summary', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/statistics/quote', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/statistics/people', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`/api/statistics/mood?moodPeriod=${moodPeriod}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (!summaryResponse.ok || !quoteResponse.ok || !peopleResponse.ok || !moodResponse.ok) {
        throw new Error('Error al cargar estadísticas');
      }

      const [summaryData, quoteData, peopleData, moodData] = await Promise.all([
        summaryResponse.json(),
        quoteResponse.json(),
        peopleResponse.json(),
        moodResponse.json()
      ]);

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
  }, [user, moodPeriod]);

  const updateSection = useCallback(async (section: 'summary' | 'quote' | 'people' | 'mood') => {
    if (!user?.uid) return;
    
    setLoadingSection(section);
    setError(null);
    
    try {
      const token = await user.getIdToken();
      
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
  }, [user, moodPeriod]);

  useEffect(() => {
    if (user?.uid) {
      loadStatistics();
    }
  }, [user?.uid, loadStatistics]);

  useEffect(() => {
    if (user?.uid && data) {
      updateSection('mood');
    }
  }, [moodPeriod, user?.uid, data, updateSection]);

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

  const displayedPeople = showAllPeople ? data?.topPeople || [] : (data?.topPeople || []).slice(0, 5);

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
                  <FiTrendingUp className="text-purple-600" />
                  <span>Resumen de la semana</span>
                </h3>
                <button
                  onClick={() => updateSection('summary')}
                  disabled={loadingSection === 'summary'}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-100 hover:bg-purple-200 rounded-xl transition-colors disabled:opacity-50"
                  title="Actualizar resumen"
                >
                  <FiRefreshCw size={16} className={`text-purple-600 ${loadingSection === 'summary' ? 'animate-spin' : ''}`} />
                  <span className="text-purple-600 font-medium">
                    {loadingSection === 'summary' ? 'Actualizando...' : 'Actualizar'}
                  </span>
                </button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-700 leading-relaxed">
                {data?.weekSummary || "Cargando resumen de la semana..."}
              </p>
            </div>
          </div>

          {/* Cita inspiracional */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 border-b border-blue-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                  <FiHeart className="text-blue-600" />
                  <span>Cita inspiracional</span>
                </h3>
                <button
                  onClick={() => updateSection('quote')}
                  disabled={loadingSection === 'quote'}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 rounded-xl transition-colors disabled:opacity-50"
                  title="Actualizar cita"
                >
                  <FiRefreshCw size={16} className={`text-blue-600 ${loadingSection === 'quote' ? 'animate-spin' : ''}`} />
                  <span className="text-blue-600 font-medium">
                    {loadingSection === 'quote' ? 'Actualizando...' : 'Actualizar'}
                  </span>
                </button>
              </div>
            </div>
            <div className="p-6">
              <blockquote className="text-gray-700 italic text-lg leading-relaxed text-center">
                &ldquo;{data?.instagramQuote || "Cargando cita inspiracional..."}&rdquo;
              </blockquote>
            </div>
          </div>

          {/* Top personas mencionadas */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 border-b border-green-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                  <FiUsers className="text-green-600" />
                  <span>Personas más mencionadas</span>
                </h3>
                <button
                  onClick={() => updateSection('people')}
                  disabled={loadingSection === 'people'}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-100 hover:bg-green-200 rounded-xl transition-colors disabled:opacity-50"
                  title="Actualizar ranking"
                >
                  <FiRefreshCw size={16} className={`text-green-600 ${loadingSection === 'people' ? 'animate-spin' : ''}`} />
                  <span className="text-green-600 font-medium">
                    {loadingSection === 'people' ? 'Actualizando...' : 'Actualizar'}
                  </span>
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

          {/* Gráfico de estado de ánimo */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-6 border-b border-orange-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                  <FiCalendar className="text-orange-600" />
                  <span>Estado de ánimo - {formatPeriodText()}</span>
                </h3>
                <div className="flex items-center space-x-2">
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
                  <button
                    onClick={() => updateSection('mood')}
                    disabled={loadingSection === 'mood'}
                    className="flex items-center space-x-2 px-4 py-2 bg-orange-100 hover:bg-orange-200 rounded-xl transition-colors disabled:opacity-50"
                    title="Actualizar datos"
                  >
                    <FiRefreshCw size={16} className={`text-orange-600 ${loadingSection === 'mood' ? 'animate-spin' : ''}`} />
                    <span className="text-orange-600 font-medium">
                      {loadingSection === 'mood' ? 'Actualizando...' : 'Actualizar'}
                    </span>
                  </button>
                </div>
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
                        className="bg-red-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, data?.moodData?.[0]?.stress || 0))}%` }}
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
                        className="bg-green-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, data?.moodData?.[0]?.happiness || 0))}%` }}
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
                        className="bg-gray-400 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, data?.moodData?.[0]?.neutral || 0))}%` }}
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
