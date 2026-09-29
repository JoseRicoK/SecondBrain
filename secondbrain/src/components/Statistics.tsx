"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from "recharts";
import {
  FiTrendingUp,
  FiUsers,
  FiRefreshCw,
  FiBarChart,
  FiCalendar,
  FiHeart,
  FiChevronDown,
  FiChevronUp,
  FiLock,
  FiShare,
} from "react-icons/fi";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";

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
  const {} = props;
  const { user } = useAuth();
  const {
    currentPlan,
    planLimits,
    monthlyUsage,
    loading: subscriptionLoading,
    refreshMonthlyUsage,
  } = useSubscription();

  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<StatisticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllPeople, setShowAllPeople] = useState(false);
  const [moodPeriod, setMoodPeriod] = useState<"week" | "month" | "year">(
    "week",
  );
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [loadingSection, setLoadingSection] = useState<string | null>(null);
  const [accessBlocked, setAccessBlocked] = useState(false);

  const requestRevision = useRef(0);
  const loadStatistics = useCallback(
    async (refresh = false) => {
      if (!user?.uid || subscriptionLoading) return;
      const revision = ++requestRevision.current;
      setIsLoading(true);
      setLoadingSection(null);
      setError(null);
      try {
        const response = await authenticatedFetch("/api/statistics/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh }),
        });
        const result = await response.json();
        if (revision !== requestRevision.current) return;
        if (!response.ok) {
          if (response.status === 403 || (response.status === 429 && !data))
            setAccessBlocked(true);
          throw new Error(
            result.error || "No se pudieron cargar las estadísticas",
          );
        }
        setAccessBlocked(false);
        setData(result);
        setMoodPeriod("week");
        setLastUpdate(new Date());
        await refreshMonthlyUsage();
      } catch (error) {
        if (revision === requestRevision.current)
          setError(
            error instanceof Error
              ? error.message
              : "Error al cargar las estadísticas",
          );
      } finally {
        if (revision === requestRevision.current) setIsLoading(false);
      }
    },
    [user?.uid, subscriptionLoading, refreshMonthlyUsage, data],
  );

  const updateSection = useCallback(
    async (section: "summary" | "quote" | "people" | "mood") => {
      if (!user?.uid || subscriptionLoading) return;
      if (section === "summary" || section === "quote") {
        await loadStatistics(true);
        return;
      }
      const revision = ++requestRevision.current;
      setLoadingSection(section);
      setError(null);
      try {
        const response = await authenticatedFetch(
          section === "mood"
            ? `/api/statistics/mood?moodPeriod=${moodPeriod}`
            : "/api/statistics/people",
        );
        const result = await response.json();
        if (revision !== requestRevision.current) return;
        if (!response.ok)
          throw new Error(result.error || "No se pudo cargar la gráfica");
        setData((previous) =>
          previous ? { ...previous, ...result } : previous,
        );
        setLastUpdate(new Date());
      } catch (error) {
        if (revision === requestRevision.current)
          setError(
            error instanceof Error
              ? error.message
              : "Error al cargar la gráfica",
          );
      } finally {
        if (revision === requestRevision.current) setLoadingSection(null);
      }
    },
    [user?.uid, subscriptionLoading, moodPeriod, loadStatistics],
  );

  useEffect(() => {
    requestRevision.current++;
    setData(null);
    setError(null);
    setAccessBlocked(false);
    if (!subscriptionLoading && user?.uid) void loadStatistics();
    return () => {
      requestRevision.current++;
    };
    // Loading a quota refresh must not generate another report.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, subscriptionLoading, currentPlan]);

  useEffect(() => {
    if (data && !isLoading) void updateSection("mood");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moodPeriod]);

  const formatPeriodText = () => {
    const now = new Date();
    switch (moodPeriod) {
      case "week":
        return `Últimos 7 días: ${format(subDays(now, 6), "d MMM", { locale: es })} al ${format(now, "d MMM", { locale: es })}`;
      case "month":
        return format(now, "MMMM yyyy", { locale: es });
      case "year":
        return format(now, "yyyy", { locale: es });
    }
  };

  const displayedPeople = showAllPeople
    ? data?.topPeople || []
    : (data?.topPeople || []).slice(0, 5);

  const generateInstagramStoryImage = (quote: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined" || typeof document === "undefined") {
        reject(new Error("Canvas API not available in server environment"));
        return;
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      canvas.width = 1080;
      canvas.height = 1920;

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "#3B82F6");
      gradient.addColorStop(1, "#1E40AF");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = Math.random() * 3 + 1;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const maxWidth = canvas.width - 120;
      const lineHeight = 80;
      const fontSize = 64;
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

      const wrapText = (text: string, maxWidth: number) => {
        const words = text.split(" ");
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
          const word = words[i];
          const width = ctx.measureText(currentLine + " " + word).width;
          if (width < maxWidth) {
            currentLine += " " + word;
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
        ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
      });

      ctx.font =
        '32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fillText("SecondBrain", canvas.width / 2, canvas.height - 100);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to generate image"));
        }
      }, "image/png");
    });
  };

  const handleShareQuote = async () => {
    if (!data?.instagramQuote) return;

    if (typeof window === "undefined") {
      console.warn("Share functionality not available in server environment");
      return;
    }

    try {
      const imageBlob = await generateInstagramStoryImage(data.instagramQuote);

      if (
        typeof navigator !== "undefined" &&
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({
          files: [new File([imageBlob], "quote.png", { type: "image/png" })],
        })
      ) {
        const file = new File([imageBlob], "instagram-story-quote.png", {
          type: "image/png",
        });
        await navigator.share({
          title: "Mi cita personal de SecondBrain",
          text: "Comparto mi cita inspiracional del día",
          files: [file],
        });
      } else {
        const url = URL.createObjectURL(imageBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "instagram-story-quote.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error sharing quote:", error);
      if (typeof window !== "undefined" && typeof alert !== "undefined") {
        alert("Error al generar la imagen. Por favor, inténtalo de nuevo.");
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
                {currentPlan === "free"
                  ? "Las estadísticas no están disponibles en el plan gratuito."
                  : `Has alcanzado el límite de ${planLimits.statisticsAccess} accesos a estadísticas para este mes.`}
              </p>
              {monthlyUsage && (
                <p className="text-sm text-slate-500 mb-6">
                  Accesos utilizados: {monthlyUsage.statisticsAccess}/
                  {planLimits.statisticsAccess === -1
                    ? "∞"
                    : planLimits.statisticsAccess}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                // Navegar a settings - esto se puede mejorar con un router si tienes uno
                const settingsButton = document.querySelector(
                  "[data-settings-button]",
                ) as HTMLButtonElement;
                if (settingsButton) {
                  settingsButton.click();
                } else {
                  // Fallback: recargar página y mostrar mensaje
                  alert("Ve a Configuración para actualizar tu plan");
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
          <p className="text-sm text-slate-500 mb-4">
            Un informe nuevo consume un acceso. Cambiar el periodo de las
            gráficas no consume accesos. Los informes se reutilizan durante 30
            minutos.
          </p>
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-white">
                <FiBarChart size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-800">
                  Estadísticas
                </h1>
                <p className="text-slate-600">
                  {lastUpdate
                    ? `Última actualización: ${format(lastUpdate, "HH:mm", { locale: es })}`
                    : "Análisis de tu progreso personal"}
                </p>
              </div>
            </div>
            {/* Mostrar contador de accesos */}
            {monthlyUsage && (
              <div className="mt-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Informes este mes: {monthlyUsage.statisticsAccess}/
                  {planLimits.statisticsAccess === -1
                    ? "∞"
                    : planLimits.statisticsAccess}
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
                onClick={() => void loadStatistics()}
                className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
              >
                Reintentar
              </button>
            </div>
          ) : accessBlocked ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">
                Has alcanzado el límite de estadísticas disponibles para tu
                plan.
                {currentPlan === "free"
                  ? " Actualiza a un plan premium para acceder a más estadísticas."
                  : " Intenta más tarde."}
              </p>
              {currentPlan === "free" && (
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
                      onClick={() => updateSection("summary")}
                      disabled={isLoading || loadingSection === "summary"}
                      className="flex items-center justify-center w-10 h-10 bg-purple-100 hover:bg-purple-200 rounded-xl transition-colors disabled:opacity-50"
                      title="Generar un informe nuevo (consume un acceso)"
                    >
                      <FiRefreshCw
                        size={16}
                        className={`text-purple-600 ${loadingSection === "summary" ? "animate-spin" : ""}`}
                      />
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
                          disabled={
                            loadingSection === "quote" || !data?.instagramQuote
                          }
                          className="flex items-center justify-center w-10 h-10 bg-blue-100 hover:bg-blue-200 rounded-xl transition-colors disabled:opacity-50"
                          title="Compartir en Instagram Stories"
                        >
                          <FiShare size={16} className="text-blue-600" />
                        </button>
                        <button
                          onClick={() => updateSection("quote")}
                          disabled={isLoading || loadingSection === "quote"}
                          className="flex items-center justify-center w-10 h-10 bg-blue-100 hover:bg-blue-200 rounded-xl transition-colors disabled:opacity-50"
                          title="Generar un informe nuevo (consume un acceso)"
                        >
                          <FiRefreshCw
                            size={16}
                            className={`text-blue-600 ${loadingSection === "quote" ? "animate-spin" : ""}`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <blockquote className="text-gray-700 italic text-lg leading-relaxed text-center">
                      &ldquo;
                      {data?.instagramQuote || "Cargando cita personal..."}
                      &rdquo;
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
                        onClick={() => updateSection("people")}
                        disabled={loadingSection === "people"}
                        className="flex items-center justify-center w-10 h-10 bg-green-100 hover:bg-green-200 rounded-xl transition-colors disabled:opacity-50"
                        title={
                          loadingSection === "people"
                            ? "Actualizando..."
                            : "Actualizar ranking"
                        }
                      >
                        <FiRefreshCw
                          size={16}
                          className={`text-green-600 ${loadingSection === "people" ? "animate-spin" : ""}`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="space-y-3">
                      {displayedPeople.map((person, index) => (
                        <div
                          key={person.name}
                          className="flex items-center justify-between bg-gray-50 rounded-xl p-4"
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                                index === 0
                                  ? "bg-yellow-500"
                                  : index === 1
                                    ? "bg-gray-400"
                                    : index === 2
                                      ? "bg-yellow-600"
                                      : "bg-green-500"
                              }`}
                            >
                              {index + 1}
                            </div>
                            <span className="font-medium text-gray-900">
                              {person.name}
                            </span>
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
                        <span>
                          {showAllPeople
                            ? "Mostrar menos"
                            : `Ver ${(data?.topPeople || []).length - 5} personas más`}
                        </span>
                        {showAllPeople ? (
                          <FiChevronUp size={16} />
                        ) : (
                          <FiChevronDown size={16} />
                        )}
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
                      onClick={() => updateSection("mood")}
                      disabled={loadingSection === "mood"}
                      className="flex items-center justify-center w-10 h-10 bg-orange-100 hover:bg-orange-200 rounded-xl transition-colors disabled:opacity-50"
                      title={
                        loadingSection === "mood"
                          ? "Actualizando..."
                          : "Actualizar datos"
                      }
                    >
                      <FiRefreshCw
                        size={16}
                        className={`text-orange-600 ${loadingSection === "mood" ? "animate-spin" : ""}`}
                      />
                    </button>
                  </div>

                  {/* Selector de período centrado */}
                  <div className="flex justify-center">
                    <select
                      value={moodPeriod}
                      onChange={(e) =>
                        setMoodPeriod(
                          e.target.value as "week" | "month" | "year",
                        )
                      }
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
                                margin={{
                                  top: 10,
                                  right: 10,
                                  left: -15,
                                  bottom: 0,
                                }}
                              >
                                <defs>
                                  <linearGradient
                                    id="colorHappiness"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                  >
                                    <stop
                                      offset="5%"
                                      stopColor="#22c55e"
                                      stopOpacity={0.8}
                                    />
                                    <stop
                                      offset="95%"
                                      stopColor="#22c55e"
                                      stopOpacity={0.1}
                                    />
                                  </linearGradient>
                                  <linearGradient
                                    id="colorSadness"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                  >
                                    <stop
                                      offset="5%"
                                      stopColor="#3b82f6"
                                      stopOpacity={0.8}
                                    />
                                    <stop
                                      offset="95%"
                                      stopColor="#3b82f6"
                                      stopOpacity={0.1}
                                    />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  vertical={false}
                                  opacity={0.2}
                                />
                                <XAxis
                                  dataKey="date"
                                  tickFormatter={(value) => {
                                    const date = new Date(value);
                                    return date.getDate().toString();
                                  }}
                                  tick={{ fontSize: 12 }}
                                  axisLine={{
                                    stroke: "#E5E7EB",
                                    strokeWidth: 1,
                                  }}
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
                                    if (name === "happiness")
                                      return [`${value}%`, "Felicidad"];
                                    if (name === "sadness")
                                      return [`${value}%`, "Tristeza"];
                                    return [value, name];
                                  }}
                                  labelFormatter={(label) => {
                                    const date = new Date(label);
                                    return format(date, "d MMM yyyy", {
                                      locale: es,
                                    });
                                  }}
                                  contentStyle={{
                                    borderRadius: "8px",
                                    border: "1px solid #E5E7EB",
                                    boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1)",
                                    backgroundColor: "rgba(255,255,255,0.95)",
                                  }}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="happiness"
                                  stroke="#22c55e"
                                  fill="url(#colorHappiness)"
                                  strokeWidth={3}
                                  dot={{
                                    r: 4,
                                    fill: "#22c55e",
                                    stroke: "#22c55e",
                                    strokeWidth: 1,
                                  }}
                                  activeDot={{
                                    r: 6,
                                    fill: "#22c55e",
                                    stroke: "#ffffff",
                                    strokeWidth: 2,
                                  }}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="sadness"
                                  stroke="#3b82f6"
                                  fill="url(#colorSadness)"
                                  strokeWidth={3}
                                  strokeDasharray="5 3"
                                  dot={{
                                    r: 4,
                                    fill: "#3b82f6",
                                    stroke: "#3b82f6",
                                    strokeWidth: 1,
                                  }}
                                  activeDot={{
                                    r: 6,
                                    fill: "#3b82f6",
                                    stroke: "#ffffff",
                                    strokeWidth: 2,
                                  }}
                                />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Leyenda */}
                          <div className="flex justify-around mt-2">
                            <div className="text-center">
                              <div className="flex items-center justify-center mb-1">
                                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                                <span className="text-sm font-medium text-green-700">
                                  Felicidad
                                </span>
                              </div>
                              <div className="text-xl font-bold text-green-600">
                                {Math.round(
                                  data.moodData.reduce(
                                    (acc, point) =>
                                      acc + (point.happiness || 0),
                                    0,
                                  ) / data.moodData.length,
                                )}
                                %
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="flex items-center justify-center mb-1">
                                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                                <span className="text-sm font-medium text-blue-700">
                                  Tristeza
                                </span>
                              </div>
                              <div className="text-xl font-bold text-blue-600">
                                {Math.round(
                                  data.moodData.reduce(
                                    (acc, point) => acc + (point.sadness || 0),
                                    0,
                                  ) / data.moodData.length,
                                )}
                                %
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                          <FiBarChart size={32} className="mb-2 opacity-50" />
                          <p className="text-sm text-center">
                            No hay datos emocionales para este período.
                            <br />
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
                                margin={{
                                  top: 10,
                                  right: 10,
                                  left: -15,
                                  bottom: 0,
                                }}
                              >
                                <defs>
                                  <linearGradient
                                    id="colorStress"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                  >
                                    <stop
                                      offset="5%"
                                      stopColor="#ef4444"
                                      stopOpacity={0.8}
                                    />
                                    <stop
                                      offset="95%"
                                      stopColor="#ef4444"
                                      stopOpacity={0.1}
                                    />
                                  </linearGradient>
                                  <linearGradient
                                    id="colorTranquility"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                  >
                                    <stop
                                      offset="5%"
                                      stopColor="#10b981"
                                      stopOpacity={0.8}
                                    />
                                    <stop
                                      offset="95%"
                                      stopColor="#10b981"
                                      stopOpacity={0.1}
                                    />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  vertical={false}
                                  opacity={0.2}
                                />
                                <XAxis
                                  dataKey="date"
                                  tickFormatter={(value) => {
                                    const date = new Date(value);
                                    return date.getDate().toString();
                                  }}
                                  tick={{ fontSize: 12 }}
                                  axisLine={{
                                    stroke: "#E5E7EB",
                                    strokeWidth: 1,
                                  }}
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
                                    if (name === "stress")
                                      return [`${value}%`, "Tensión"];
                                    if (name === "tranquility")
                                      return [`${value}%`, "Calma"];
                                    return [value, name];
                                  }}
                                  labelFormatter={(label) => {
                                    const date = new Date(label);
                                    return format(date, "d MMM yyyy", {
                                      locale: es,
                                    });
                                  }}
                                  contentStyle={{
                                    borderRadius: "8px",
                                    border: "1px solid #E5E7EB",
                                    boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1)",
                                    backgroundColor: "rgba(255,255,255,0.95)",
                                  }}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="stress"
                                  stroke="#ef4444"
                                  fill="url(#colorStress)"
                                  strokeWidth={3}
                                  dot={{
                                    r: 4,
                                    fill: "#ef4444",
                                    stroke: "#ef4444",
                                    strokeWidth: 1,
                                  }}
                                  activeDot={{
                                    r: 6,
                                    fill: "#ef4444",
                                    stroke: "#ffffff",
                                    strokeWidth: 2,
                                  }}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="tranquility"
                                  stroke="#10b981"
                                  fill="url(#colorTranquility)"
                                  strokeWidth={3}
                                  strokeDasharray="5 3"
                                  dot={{
                                    r: 4,
                                    fill: "#10b981",
                                    stroke: "#10b981",
                                    strokeWidth: 1,
                                  }}
                                  activeDot={{
                                    r: 6,
                                    fill: "#10b981",
                                    stroke: "#ffffff",
                                    strokeWidth: 2,
                                  }}
                                />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Leyenda */}
                          <div className="flex justify-around mt-2">
                            <div className="text-center">
                              <div className="flex items-center justify-center mb-1">
                                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                                <span className="text-sm font-medium text-red-700">
                                  Tensión
                                </span>
                              </div>
                              <div className="text-xl font-bold text-red-600">
                                {Math.round(
                                  data.moodData.reduce(
                                    (acc, point) => acc + (point.stress || 0),
                                    0,
                                  ) / data.moodData.length,
                                )}
                                %
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="flex items-center justify-center mb-1">
                                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                                <span className="text-sm font-medium text-green-700">
                                  Calma
                                </span>
                              </div>
                              <div className="text-xl font-bold text-green-600">
                                {Math.round(
                                  data.moodData.reduce(
                                    (acc, point) =>
                                      acc + (point.tranquility || 0),
                                    0,
                                  ) / data.moodData.length,
                                )}
                                %
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                          <FiBarChart size={32} className="mb-2 opacity-50" />
                          <p className="text-sm text-center">
                            No hay datos emocionales para este período.
                            <br />
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
