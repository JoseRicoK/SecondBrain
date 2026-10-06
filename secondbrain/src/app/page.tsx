"use client";

import { useDiaryAnalysis } from "@/hooks/useDiaryAnalysis";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { recordingFilename, transcribeAudio } from "@/lib/transcription-client";
import { RECORDING_OPTIONS, RECORDING_LIMIT_NOTICE, recordingTime, startLimitedRecording } from "@/lib/audio-recording";

import { useEffect, useState, useRef, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import PersonalChat from "@/components/PersonalChat";
import Auth from "@/components/Auth";
import Loading from "@/components/Loading";
import Settings from "@/components/Settings";
import StatisticsWrapper from "@/components/StatisticsWrapper";
import PeopleManager from "@/components/PeopleManager";
import { useAuth } from "@/hooks/useAuth";
import { useDiaryStore } from "@/lib/store";
import {
  FiMenu,
  FiEdit2,
  FiSave,
  FiX,
  FiMic,
  FiStopCircle,
  FiZap,
  FiUsers,
  FiUser,
} from "react-icons/fi";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Image from "next/image";
import { AuthUser } from "@/lib/supabase-operations";

export default function Home() {
  const { user, loading } = useAuth();

  const {
    fetchCurrentEntry,
    currentDate,
    currentEntry,
    isLoading,
    error: storeError,
    isEditing: storeIsEditing,
    saveCurrentEntry,
    toggleEditMode: storeToggleEditMode,
  } = useDiaryStore();

  const [isClient, setIsClient] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);

  useEffect(() => {
    if (
      user?.uid &&
      new URLSearchParams(window.location.search).get("settings") === "true"
    ) {
      setShowSettings(true);
    }
  }, [user?.uid]);

  // Estados del diario
  const [content, setContent] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingNotice, setRecordingNotice] = useState<string | null>(null);
  const cancelRecordingTimer = useRef<(() => void) | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStylizing, setIsStylizing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showPeoplePanel, setShowPeoplePanel] = useState(false); // Cambiado a false por defecto para mejor responsive
  const [peopleRefreshTrigger, setPeopleRefreshTrigger] = useState(0);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [mentionedPeople, setMentionedPeople] = useState<string[]>([]);
  const [mentionedPersonIds, setMentionedPersonIds] = useState<string[] | null>(null);

  // Estado para controlar el comportamiento responsive del panel de personas
  const [isDesktop, setIsDesktop] = useState(false);

  // Referencias del diario
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const currentStream = useRef<MediaStream | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const lastUserId = useRef<string | null>(null);
  const attemptedAudio = useRef<Blob | null>(null);
  const transcriptionPending = useRef(false);
  const extractionPending = useRef(false);
  const recordingContext = `${user?.uid || ""}:${currentDate}`;
  const activeRecordingContext = useRef(recordingContext);
  activeRecordingContext.current = recordingContext;
  const latestContent = useRef(content);
  latestContent.current = content;

  const { analysis, restart: restartAnalysis } = useDiaryAnalysis(currentEntry, user?.uid, (entry) => {
    const state = useDiaryStore.getState();
    if (state.currentEntry?.id !== entry.id || state.currentDate !== entry.date || state.currentEntry.user_id !== entry.user_id) return;
    setPeopleRefreshTrigger(value => value + 1);
    // Refresh metadata only: an in-progress draft must never be replaced by a worker response.
    if (state.currentEntry.content === entry.content && latestContent.current === entry.content) {
      useDiaryStore.setState({ currentEntry: entry });
      setMentionedPeople(entry.mentioned_people || []);
      setMentionedPersonIds(entry.mentioned_person_ids ?? null);
    }
  });

  useEffect(() => {
    cancelRecordingTimer.current?.();
    setRecordingNotice(null);
    setAudioBlob(null);
    attemptedAudio.current = null;
    const recorder = mediaRecorder.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    currentStream.current?.getTracks().forEach((track) => track.stop());
    currentStream.current = null;
    setIsRecording(false);
    return () => {
      cancelRecordingTimer.current?.();
      const activeRecorder = mediaRecorder.current;
      if (activeRecorder && activeRecorder.state !== "inactive") {
        activeRecorder.onstop = null;
        activeRecorder.ondataavailable = null;
        activeRecorder.stop();
      }
      currentStream.current?.getTracks().forEach((track) => track.stop());
      currentStream.current = null;
    };
  }, [recordingContext]);

  useEffect(() => {
    if (!audioBlob) {
      setAudioPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(audioBlob);
    setAudioPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioBlob]);

  // Referencia para el último estado logueado para evitar logs duplicados
  const lastLoggedState = useRef<{
    currentEntry?: string;
    isLoading: boolean;
    storeIsEditing: boolean;
    showSettings: boolean;
    contentLength: number;
  } | null>(null);

  // Log optimizado para evitar repeticiones
  const logStateChange = useCallback(() => {
    const currentState = {
      currentEntry: currentEntry?.id,
      isLoading,
      storeIsEditing,
      showSettings,
      contentLength: content.length,
    };

    if (
      JSON.stringify(currentState) !== JSON.stringify(lastLoggedState.current)
    ) {
      console.log("📝 DIARY: Estado actual:", currentState);
      lastLoggedState.current = currentState;
    }
  }, [
    currentEntry?.id,
    isLoading,
    storeIsEditing,
    showSettings,
    content.length,
  ]);

  // Solo loguear cambios significativos
  useEffect(() => {
    logStateChange();
  }, [logStateChange]);

  // Funciones del diario
  const handleToggleEditMode = () => {
    console.log("📝 DIARY: Toggle edit mode");

    // Si se está cancelando la edición, restaurar el contenido original
    if (storeIsEditing) {
      // Si hay una entrada, restaurar su contenido, si no hay entrada, limpiar el campo
      if (currentEntry) {
        setContent(currentEntry.content || "");
        setMentionedPeople(currentEntry.mentioned_people || []);
        setMentionedPersonIds(currentEntry.mentioned_person_ids ?? null);
      } else {
        setContent("");
        setMentionedPeople([]);
        setMentionedPersonIds(null);
      }
      setError(null);
    }

    storeToggleEditMode();
  };

  const handleSave = async () => {
    if (!user?.uid) return;

    console.log("📝 DIARY: Guardando entrada...");
    console.log("📝 DIARY: Personas mencionadas a guardar:", mentionedPeople);
    try {
      await saveCurrentEntry(content, user.uid, mentionedPeople, mentionedPersonIds);
      console.log("📝 DIARY: Entrada guardada exitosamente");
    } catch (error) {
      console.error("📝 DIARY: Error al guardar:", error);
      setError("Error al guardar la entrada");
    }
  };

  const handleStylize = async () => {
    if (!user?.uid) return;

    console.log("📝 DIARY: Estilizando texto...");
    setIsStylizing(true);
    setError(null);

    try {
      // Obtener token de Supabase
      const token = await user.getIdToken();

      const response = await fetch("/api/stylize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: content,
          userId: user.uid,
        }),
      });

      if (!response.ok) {
        throw new Error("Error en la respuesta del servidor");
      }

      const data = await response.json();
      console.log("📝 DIARY: Respuesta de estilización:", data);

      if (data.stylizedText) {
        setContent(data.stylizedText);
        console.log("📝 DIARY: Texto estilizado exitosamente");

        // Guardar automáticamente la entrada estilizada
        try {
          await saveCurrentEntry(data.stylizedText, user.uid, mentionedPeople, mentionedPersonIds);
          console.log("📝 DIARY: Entrada estilizada guardada automáticamente");
        } catch (saveError) {
          console.error(
            "📝 DIARY: Error al guardar entrada automáticamente:",
            saveError,
          );
          // No mostramos error al usuario ya que la estilización fue exitosa
        }
      } else {
        console.warn("📝 DIARY: No se recibió texto estilizado");
        setError("No se pudo estilizar el texto");
      }
    } catch (error) {
      console.error("📝 DIARY: Error al estilizar:", error);
      setError("Error al estilizar el texto");
    } finally {
      setIsStylizing(false);
    }
  };

  const handleExtractPeople = async () => {
    if (!user?.uid || extractionPending.current || !content.trim()) return;
    const context = activeRecordingContext.current;
    const analyzedContent = content;
    extractionPending.current = true;
    setIsExtracting(true);
    setError(null);
    try {
      await saveCurrentEntry(analyzedContent, user.uid, mentionedPeople, mentionedPersonIds);
      if (activeRecordingContext.current !== context) return;
      const state = useDiaryStore.getState();
      if (state.error || !state.currentEntry) throw new Error(state.error || "No se pudo guardar la entrada.");
      const response = await authenticatedFetch("/api/diary-analysis", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: state.currentEntry.id }),
      });
      const data = await response.json();
      if (activeRecordingContext.current !== context) return;
      if (!response.ok) throw new Error(data.error || "No se pudo iniciar el análisis.");
      restartAnalysis();
    } catch (failure) {
      if (activeRecordingContext.current === context) {
        setError(
          failure instanceof Error
            ? failure.message
            : "No se pudo completar el análisis de personas.",
        );
      }
    } finally {
      extractionPending.current = false;
      setIsExtracting(false);
    }
  };

  const startRecording = async () => {
    if (audioBlob || transcriptionPending.current || mediaRecorder.current?.state === 'recording') return;
    const context = activeRecordingContext.current;
    console.log("📝 DIARY: Iniciando grabación...");
    setError(null);
    setRecordingNotice(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (activeRecordingContext.current !== context) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      currentStream.current = stream;
      const recorder = new MediaRecorder(stream, RECORDING_OPTIONS);
      mediaRecorder.current = recorder;
      audioChunks.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        cancelRecordingTimer.current?.();
        setIsRecording(false);
        const audioBlob = new Blob(audioChunks.current, {
          type:
            recorder.mimeType || audioChunks.current[0]?.type || "audio/webm",
        });
        setAudioBlob(audioBlob);
        console.log("📝 DIARY: Grabación completada");

        // Detener los tracks del stream
        if (currentStream.current) {
          currentStream.current.getTracks().forEach((track) => track.stop());
          currentStream.current = null;
        }
      };

      cancelRecordingTimer.current = startLimitedRecording(recorder, setRecordingSeconds, () => {
        setRecordingNotice(RECORDING_LIMIT_NOTICE);
      });
      setIsRecording(true);
    } catch (error) {
      cancelRecordingTimer.current?.();
      currentStream.current?.getTracks().forEach(track => track.stop());
      currentStream.current = null;
      console.error("📝 DIARY: Error al acceder al micrófono:", error);
      setError("Error al acceder al micrófono");
    }
  };

  const stopRecording = () => {
    console.log("📝 DIARY: Deteniendo grabación...");
    cancelRecordingTimer.current?.();
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  const processTranscription = useCallback(async () => {
    if (!audioBlob || !user?.uid || transcriptionPending.current) return;
    const context = activeRecordingContext.current;
    attemptedAudio.current = audioBlob;
    transcriptionPending.current = true;

    console.log("📝 DIARY: Procesando transcripción...");
    setIsProcessing(true);
    setError(null);

    try {
      const data = await transcribeAudio(audioBlob);
      if (activeRecordingContext.current !== context) return;

      if (data.text) {
        const draft = latestContent.current;
        const newContent = draft + (draft ? "\n\n" : "") + data.text;
        setContent(newContent);
        setAudioBlob(null);

        // Guardar automáticamente después de la transcripción
        try {
          await saveCurrentEntry(newContent, user.uid, mentionedPeople, mentionedPersonIds);
          console.log(
            "📝 DIARY: Entrada guardada automáticamente después de la transcripción",
          );
        } catch (saveError) {
          console.error(
            "📝 DIARY: Error al guardar automáticamente:",
            saveError,
          );
          // No hacer throw aquí para no afectar el flujo de transcripción
        }
      } else {
        console.warn("📝 DIARY: No se recibió texto de la transcripción");
      }
    } catch (error) {
      if (activeRecordingContext.current === context)
        setError(
          error instanceof Error
            ? error.message
            : "No se pudo transcribir el audio. Inténtalo de nuevo.",
        );
    } finally {
      transcriptionPending.current = false;
      setIsProcessing(false);
    }
  }, [audioBlob, user?.uid, content, saveCurrentEntry, mentionedPeople, mentionedPersonIds]);

  // Sincronizar content con currentEntry
  useEffect(() => {
    if (currentEntry?.content !== undefined) {
      setContent(currentEntry.content || "");
      console.log("📝 DIARY: Contenido sincronizado desde currentEntry");

      // También sincronizar las personas mencionadas
      if (currentEntry?.mentioned_people) {
        setMentionedPeople(currentEntry.mentioned_people);
        setMentionedPersonIds(currentEntry.mentioned_person_ids ?? null);
      } else {
        setMentionedPeople([]);
        setMentionedPersonIds(null);
      }
    } else if (currentEntry === null) {
      // Si no hay entrada para esta fecha, limpiar el contenido
      setContent("");
      setMentionedPeople([]);
        setMentionedPersonIds(null);
      setError(null);
      console.log(
        "📝 DIARY: Contenido limpiado - no hay entrada para esta fecha",
      );
    }
  }, [currentEntry]);

  // Función para manejar click en personas mencionadas
  const handlePersonClick = (personName: string) => {
    setSelectedPersonId(personName);
    setShowPeoplePanel(true);
    console.log("📝 DIARY: Seleccionada persona:", personName);
  };

  // Procesar transcripción cuando hay audioBlob
  useEffect(() => {
    if (audioBlob && audioBlob !== attemptedAudio.current && !isProcessing) {
      processTranscription();
    }
  }, [audioBlob, isProcessing, processTranscription]);

  // Funciones para manejar el chat personal
  const handleChatClose = () => {
    setIsChatOpen(false);
    setIsChatMinimized(false);
  };

  const handleChatMinimizeToggle = () => {
    setIsChatMinimized(!isChatMinimized);
  };

  const handleAuthSuccess = async (
    authenticatedUser: AuthUser,
    selectedPlan?: string,
  ) => {
    // El hook useAuth se encargará de actualizar el estado
    console.log("Usuario autenticado:", authenticatedUser.uid);

    // Si hay un plan seleccionado, verificar si es apropiado redirigir
    if (selectedPlan) {
      console.log("Plan seleccionado desde URL:", selectedPlan);

      try {
        // Obtener el perfil del usuario para verificar su plan actual
        const response = await authenticatedFetch("/api/subscription/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: authenticatedUser.uid }),
        });

        if (response.ok) {
          const { subscription } = await response.json();
          const currentPlan = subscription?.plan || "free";

          // Solo redirigir si:
          // 1. El usuario tiene plan gratuito y selecciona un plan de pago, O
          // 2. El usuario quiere cambiar a un plan diferente del que ya tiene
          const shouldRedirect =
            (currentPlan === "free" &&
              ["pro", "elite"].includes(selectedPlan)) ||
            (currentPlan !== selectedPlan &&
              ["pro", "elite"].includes(selectedPlan));

          if (shouldRedirect) {
            console.log(
              "Redirigiendo a suscripción - plan actual:",
              currentPlan,
              "-> plan solicitado:",
              selectedPlan,
            );
            window.location.href = `/subscription?plan=${selectedPlan}`;
            return;
          } else {
            console.log(
              "No redirigiendo - usuario ya tiene plan adecuado:",
              currentPlan,
            );
            // Si selecciona "free" pero ya tiene un plan de pago, no hacer nada
            // Si ya tiene el plan que seleccionó, no hacer nada
          }
        } else {
          // Si hay error obteniendo el estado, mejor no redirigir
          console.warn(
            "Error obteniendo estado de suscripción, no redirigiendo",
          );
        }
      } catch (error) {
        console.error("Error verificando estado de suscripción:", error);
        // En caso de error, no redirigir para evitar cambios no deseados
      }
    }
  };

  // Obtener los datos de la entrada actual cuando cambia la fecha o el usuario
  useEffect(() => {
    if (isClient && user?.uid) {
      fetchCurrentEntry(user.uid);
    }
  }, [fetchCurrentEntry, isClient, currentDate, user?.uid]);

  // Evitar errores de hidratación y detectar tamaño de pantalla
  useEffect(() => {
    setIsClient(true);

    // Función para detectar si es escritorio
    const checkScreenSize = () => {
      const isDesktopSize = window.innerWidth >= 1280; // xl breakpoint
      setIsDesktop(isDesktopSize);

      // NO abrir automáticamente el panel de personas - déjalo cerrado por defecto
    };

    // Verificar tamaño inicial
    checkScreenSize();

    // Agregar listener para cambios de tamaño
    window.addEventListener("resize", checkScreenSize);

    return () => {
      window.removeEventListener("resize", checkScreenSize);
    };
  }, [showPeoplePanel]);

  if (!isClient) {
    return <Loading />;
  }

  // Mostrar pantalla de carga mientras se verifica la autenticación
  if (loading) {
    return <Loading />;
  }

  // Mostrar pantalla de autenticación si no hay usuario
  if (!user) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  // Log de renderizado solo cuando el usuario cambia
  if (user?.uid && user.uid !== lastUserId.current) {
    console.log("🎯 PAGE: Renderizando aplicación para user:", user.uid);
    lastUserId.current = user.uid;
  }

  return (
    <main className="flex h-screen min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 overflow-hidden">
      {/* Sidebar con overlay cuando está abierto en móvil */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-md z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - diseño flotante en móvil */}
      <aside
        className={`
          fixed md:relative z-30 h-screen transition-all duration-300 ease-in-out
          ${isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}
          md:translate-x-0 md:shadow-xl 
          md:w-[340px] lg:w-[380px] xl:w-[420px] w-[85%] max-w-md
          bg-white/95 backdrop-blur-xl border-r border-white/20
        `}
      >
        {/* El botón X se moverá al componente Sidebar para superponerse */}
        <div className="overflow-y-auto h-full">
          <Sidebar
            userId={user.uid}
            onClose={() => setIsSidebarOpen(false)}
            onSettingsClick={() => {
              setShowSettings(true);
              setShowStatistics(false);
              // Auto-cerrar sidebar en móvil al abrir configuración
              setIsSidebarOpen(false);
            }}
            isChatOpen={isChatOpen}
            onPersonalChatClick={() => {
              setIsChatOpen(true);
              setIsChatMinimized(false);
              setIsSidebarOpen(false);
            }}
            onStatisticsClick={() => {
              setShowStatistics(true);
              setShowSettings(false);
              // Auto-cerrar sidebar en móvil al abrir estadísticas
              setIsSidebarOpen(false);
            }}
            onDateChange={() => {
              setShowSettings(false);
              setShowStatistics(false);
              // Auto-cerrar sidebar en móvil al seleccionar fecha
              setIsSidebarOpen(false);
            }}
          />
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header minimalista solo en móvil */}
        <header className="md:hidden bg-white/90 backdrop-blur-xl p-4 flex items-center border-b border-slate-200/60 shadow-sm">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-slate-700 hover:text-indigo-600 transition-colors duration-200"
            aria-label="Open sidebar"
          >
            <FiMenu size={24} />
          </button>
          <div className="ml-4 flex items-center gap-2">
            <Image
              src="/brand/logo.png"
              alt=""
              width={32}
              height={32}
              priority
            />
            <span className="font-bold text-slate-800">LumaDiary</span>
          </div>
        </header>

        {/* Área principal */}
        <div className="flex-1 overflow-y-auto">
          {/* Renderizar vista de configuración */}
          {showSettings ? (
            <div className="max-w-7xl mx-auto p-2 sm:p-4 md:p-8">
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-200/60 p-3 sm:p-6 bg-gradient-to-r from-indigo-50 to-purple-50 sticky top-0 z-10">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    <span className="text-slate-800 text-xl font-semibold">
                      Configuración
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => {
                        setShowSettings(false);
                        setShowStatistics(false);
                      }}
                      className="flex items-center space-x-2 min-h-11 px-3 sm:px-4 py-2 bg-white/80 text-slate-700 rounded-xl hover:bg-white transition-all duration-200 shadow-sm border border-white/40"
                    >
                      <span>Volver al diario</span>
                    </button>
                  </div>
                </div>
                <Settings userId={user.uid} />
              </div>
            </div>
          ) : showStatistics ? (
            /* Vista de Estadísticas */
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden mx-4 md:mx-8 my-4 md:my-8">
              <div className="flex items-center justify-between border-b border-slate-200/60 p-6 bg-gradient-to-r from-purple-50 to-blue-50 sticky top-0 z-10">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-slate-800 text-xl font-semibold">
                    Estadísticas
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      setShowStatistics(false);
                      setShowSettings(false);
                    }}
                    className="flex items-center space-x-2 min-h-11 px-3 sm:px-4 py-2 bg-white/80 text-slate-700 rounded-xl hover:bg-white transition-all duration-200 shadow-sm border border-white/40"
                  >
                    <span>Volver al diario</span>
                  </button>
                </div>
              </div>
              <StatisticsWrapper
                userId={user.uid}
                onOpenEntry={(date) => {
                  useDiaryStore.getState().setCurrentDate(date);
                  setShowStatistics(false);
                }}
                onOpenPerson={(name) => {
                  setShowStatistics(false);
                  handlePersonClick(name);
                }}
              />
            </div>
          ) : (
            /* Vista principal del diario */
            <div className="max-w-7xl mx-auto h-full">
              <div className="flex gap-6 h-full relative p-4 md:p-8">
                {/* Contenido principal del diario - siempre toma el espacio completo */}
                <div className="flex-1 bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden flex flex-col">
                  {/* Barra de herramientas mejorada con fecha arriba */}
                  <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 flex-shrink-0">
                    {/* Fecha arriba - centrada y más pequeña */}
                    <div className="flex items-center justify-center space-x-3 mb-4">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                      <span className="text-slate-600 text-sm font-medium">
                        {currentEntry?.date
                          ? format(
                              new Date(currentEntry.date),
                              "EEEE, d 'de' MMMM",
                              { locale: es },
                            )
                          : "Nueva entrada"}
                      </span>
                    </div>

                    {/* Botones de acción abajo - centrados */}
                    <div className="flex items-center justify-center space-x-2">
                      {storeIsEditing ? (
                        <>
                          <button
                            onClick={handleStylize}
                            disabled={isStylizing || !content}
                            className={`flex items-center justify-center p-3 sm:px-4 sm:py-2 sm:space-x-2 rounded-xl transition-all duration-200 ${isStylizing ? "bg-indigo-400" : "bg-indigo-500"} text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg`}
                            title="Estilizar con IA"
                          >
                            <FiZap size={18} />
                            <span className="font-medium hidden sm:inline">
                              Estilizar
                            </span>
                          </button>

                          {!isRecording ? (
                            <button
                              onClick={startRecording}
                              disabled={isProcessing || Boolean(audioBlob)}
                              className="flex items-center justify-center p-3 sm:px-4 sm:py-2 sm:space-x-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                              title="Iniciar grabación"
                            >
                              <FiMic size={18} />
                              <span className="font-medium hidden sm:inline">
                                Grabar
                              </span>
                            </button>
                          ) : (
                            <button
                              onClick={stopRecording}
                              className="flex items-center justify-center p-3 sm:px-4 sm:py-2 sm:space-x-2 bg-slate-700 text-white rounded-xl hover:bg-slate-800 transition-all duration-200 shadow-lg animate-pulse"
                              title="Detener grabación"
                            >
                              <FiStopCircle size={18} />
                              <span className="font-medium hidden sm:inline">
                                Detener
                              </span>
                            </button>
                          )}

                          <button
                            onClick={handleSave}
                            className="flex items-center justify-center p-3 sm:px-4 sm:py-2 sm:space-x-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all duration-200 shadow-lg"
                            title="Guardar"
                          >
                            <FiSave size={18} />
                            <span className="font-medium hidden sm:inline">
                              Guardar
                            </span>
                          </button>

                          <button
                            onClick={handleToggleEditMode}
                            className="flex items-center justify-center p-3 sm:px-4 sm:py-2 sm:space-x-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all duration-200 border border-slate-200"
                            title="Cancelar"
                          >
                            <FiX size={18} />
                            <span className="font-medium hidden sm:inline">
                              Cancelar
                            </span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={handleToggleEditMode}
                            className="flex items-center justify-center p-3 sm:px-4 sm:py-2 sm:space-x-2 bg-slate-50 text-slate-700 rounded-xl hover:bg-slate-100 transition-all duration-200 border border-slate-200"
                            disabled={
                              isRecording || isProcessing || Boolean(audioBlob)
                            }
                            title="Editar"
                          >
                            <FiEdit2 size={18} />
                            <span className="font-medium hidden sm:inline">
                              Editar
                            </span>
                          </button>

                          {!isRecording ? (
                            <button
                              onClick={startRecording}
                              disabled={isProcessing}
                              className="flex items-center justify-center p-3 sm:px-4 sm:py-2 sm:space-x-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                              title="Iniciar grabación"
                            >
                              <FiMic size={18} />
                              <span className="font-medium hidden sm:inline">
                                Grabar
                              </span>
                            </button>
                          ) : (
                            <button
                              onClick={stopRecording}
                              className="flex items-center justify-center p-3 sm:px-4 sm:py-2 sm:space-x-2 bg-slate-700 text-white rounded-xl hover:bg-slate-800 transition-all duration-200 shadow-lg animate-pulse"
                              title="Detener grabación"
                            >
                              <FiStopCircle size={18} />
                              <span className="font-medium hidden sm:inline">
                                Detener
                              </span>
                            </button>
                          )}

                          <button
                            onClick={handleExtractPeople}
                            disabled={isExtracting || analysis?.status === "queued" || analysis?.status === "processing" || !content}
                            className={`flex items-center justify-center p-3 sm:px-4 sm:py-2 sm:space-x-2 rounded-xl transition-all duration-200 ${isExtracting ? "bg-purple-400" : "bg-purple-500"} text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg`}
                            title="Analizar con IA"
                          >
                            <FiZap size={18} />
                            <span className="font-medium hidden sm:inline">
                              IA
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Contenido principal mejorado con fondo unificado */}
                  <div className="flex-1 bg-gradient-to-r from-indigo-50 to-purple-50 overflow-y-auto">
                    {(isRecording || recordingNotice) && (
                      <p role="status" className="mx-4 mb-4 text-sm text-slate-600">
                        {isRecording ? `Grabando ${recordingTime(recordingSeconds)} / 10:00 · Se detendrá y transcribirá automáticamente.` : recordingNotice}
                      </p>
                    )}
                    {/* Mensajes de error mejorados */}
                    {(error || storeError) && (
                      <div
                        role="alert"
                        className="mx-4 mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center space-x-3"
                      >
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span>{error || storeError}</span>
                      </div>
                    )}

                    {audioBlob && !isProcessing && audioPreviewUrl && (
                      <div className="mx-4 mb-4 p-4 bg-white border border-indigo-200 rounded-xl space-y-3">
                        <p className="text-sm text-slate-700">
                          Tu grabación sigue disponible en esta pestaña. Puedes
                          reintentar o descargarla antes de salir.
                        </p>
                        <audio
                          controls
                          src={audioPreviewUrl}
                          className="w-full"
                          aria-label="Grabación pendiente de transcribir"
                        />
                        <div className="flex flex-wrap gap-3 text-sm">
                          <button
                            onClick={() => void processTranscription()}
                            className="px-4 py-2 rounded-lg bg-indigo-600 text-white"
                          >
                            Reintentar transcripción
                          </button>
                          <a
                            href={audioPreviewUrl}
                            download={recordingFilename(audioBlob.type)}
                            className="px-4 py-2 rounded-lg border border-indigo-200 text-indigo-700"
                          >
                            Descargar grabación
                          </a>
                          <button
                            onClick={() => {
                              setAudioBlob(null);
                              setError(null);
                            }}
                            className="px-4 py-2 rounded-lg text-slate-600"
                          >
                            Descartar grabación
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Indicador de procesamiento mejorado */}
                    {isProcessing && audioBlob && (
                      <div className="mx-4 mb-4 p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-sm flex items-center space-x-3">
                        <svg
                          className="animate-spin h-5 w-5 text-blue-500"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span className="font-medium">
                          Procesando transcripción...
                        </span>
                      </div>
                    )}

                    {/* Indicador de estilización mejorado */}
                    {isStylizing && (
                      <div className="mx-4 mb-4 p-4 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-sm flex items-center space-x-3">
                        <svg
                          className="animate-spin h-5 w-5 text-indigo-500"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span className="font-medium">
                          Estilizando texto con IA...
                        </span>
                      </div>
                    )}

                    {!isExtracting && analysis && analysis.status !== "skipped" && (
                      <div role="status" className="mx-4 mb-4 rounded-xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm text-purple-700">
                        {analysis.status === "done" ? "Análisis actualizado" : analysis.status === "failed" ? analysis.error : "Analizando tu entrada… Puedes seguir escribiendo o cerrar la página."}
                      </div>
                    )}

                    {/* Indicador de extracción de personas */}
                    {isExtracting && (
                      <div className="mx-4 mb-4 p-4 bg-purple-50 border border-purple-200 text-purple-700 rounded-xl text-sm flex items-center space-x-3">
                        <svg
                          className="animate-spin h-5 w-5 text-purple-500"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span className="font-medium">
                          Extrayendo información...
                        </span>
                      </div>
                    )}

                    {/* Editor/Visualizador de contenido mejorado */}
                    <div className="px-4 pt-2 pb-4 min-h-[600px]">
                      {storeIsEditing ? (
                        <div className="relative">
                          <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Escribe tu entrada del diario aquí... ✨"
                            className="w-full h-[500px] p-4 border-2 border-slate-200 rounded-2xl resize-none focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400 text-slate-700 leading-relaxed text-lg bg-white/50 backdrop-blur-sm transition-all duration-200"
                          />
                          <div className="absolute bottom-4 right-4 text-xs text-slate-400">
                            {content.length} caracteres
                          </div>
                        </div>
                      ) : (
                        <div className="prose prose-slate prose-lg max-w-none">
                          {content ? (
                            <div
                              className="whitespace-pre-wrap text-slate-700 leading-relaxed text-lg bg-slate-50/50 p-6 rounded-2xl border border-slate-200/60 cursor-pointer hover:bg-slate-100/50 transition-colors duration-200"
                              onClick={handleToggleEditMode}
                              title="Haz clic para editar"
                            >
                              {content}
                            </div>
                          ) : (
                            <div className="text-center py-24">
                              <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <FiEdit2 className="text-indigo-500 text-2xl" />
                              </div>
                              <h3 className="text-slate-400 text-xl font-medium mb-2">
                                Tu diario está esperando
                              </h3>
                              <p className="text-slate-400">
                                Haz clic en &quot;Editar&quot; para comenzar a
                                escribir tu día.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Sección de personas mencionadas */}
                      {mentionedPeople.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-slate-200/60">
                          <div className="flex items-center space-x-3 mb-4">
                            <FiUser className="text-purple-500" size={18} />
                            <h4 className="text-slate-700 font-medium">
                              Personas mencionadas
                            </h4>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {mentionedPeople.map((person, index) => (
                              <button
                                key={index}
                                onClick={() => handlePersonClick(person)}
                                className="flex items-center space-x-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl border border-purple-200 transition-all duration-200 hover:shadow-sm"
                                title={`Ver detalles de ${person}`}
                              >
                                <FiUser size={14} />
                                <span className="text-sm font-medium">
                                  {person}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Panel de personas para escritorio (lado a lado) */}
                {showPeoplePanel && isDesktop && (
                  <div className="w-96 bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden flex flex-col max-h-screen">
                    <div className="flex items-center justify-between border-b border-slate-200/60 p-6 bg-gradient-to-r from-purple-50 to-pink-50 flex-shrink-0">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <FiUsers className="text-purple-600" size={20} />
                        <span className="text-slate-800 text-lg font-semibold">
                          Personas
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setShowPeoplePanel(false);
                          setSelectedPersonId(null);
                        }}
                        className="p-2 rounded-xl hover:bg-purple-100 text-purple-600 transition-all duration-200 border border-purple-200/60"
                        aria-label="Cerrar panel de personas"
                        title="Cerrar"
                      >
                        <FiX size={20} />
                      </button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto p-6">
                      <PeopleManager
                        userId={user.uid}
                        refreshTrigger={peopleRefreshTrigger}
                        className="shadow-none"
                        initialSelectedName={selectedPersonId}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Panel de personas para móvil y tablet (overlay de pantalla completa) */}
              {showPeoplePanel && !isDesktop && (
                <>
                  {/* Overlay backdrop - clickeable para cerrar */}
                  <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 cursor-pointer"
                    onClick={() => {
                      setShowPeoplePanel(false);
                      setSelectedPersonId(null);
                    }}
                  />

                  {/* Panel modal - adaptado para Safari móvil con viewport dinámico */}
                  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
                    <div
                      className="w-full mobile-modal-height sm:w-full sm:max-w-2xl sm:h-auto sm:max-h-[85dvh] bg-white sm:rounded-2xl shadow-2xl border-0 sm:border border-white/20 overflow-hidden animate-in slide-in-from-bottom-4 duration-300 pointer-events-auto flex flex-col"
                      onClick={(e) => e.stopPropagation()} // Evitar que el clic en el modal lo cierre
                    >
                      {/* Header fijo con safe area para muesca */}
                      <div className="flex items-center justify-between border-b border-slate-200/60 p-4 sm:p-6 bg-gradient-to-r from-purple-50 to-pink-50 flex-shrink-0 pt-safe-or-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          <FiUsers className="text-purple-600" size={20} />
                          <span className="text-slate-800 text-lg font-semibold">
                            Personas
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setShowPeoplePanel(false);
                            setSelectedPersonId(null);
                          }}
                          className="p-2 rounded-xl hover:bg-purple-100 text-purple-600 transition-all duration-200 border border-purple-200/60"
                          aria-label="Cerrar panel de personas"
                          title="Cerrar"
                        >
                          <FiX size={20} />
                        </button>
                      </div>

                      {/* Contenido scrolleable con safe area para barra de Safari */}
                      <div className="flex-1 overflow-y-auto p-4 sm:p-6 overscroll-contain pb-safe-or-4 min-h-0">
                        <PeopleManager
                          userId={user.uid}
                          refreshTrigger={peopleRefreshTrigger}
                          className="shadow-none"
                          initialSelectedName={selectedPersonId}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Botones flotantes */}
      <>
        {/* Botón flotante de personas para escritorio - solo visible cuando el panel está cerrado */}
        {!showPeoplePanel && isDesktop && (
          <button
            onClick={() => setShowPeoplePanel(true)}
            className="fixed top-1/2 right-0 transform -translate-y-1/2 w-14 h-32 flex flex-col items-center justify-center transition-all duration-300 shadow-[0_0_12px_3px_rgba(121,78,184,0.48),0_0_32px_8px_rgba(139,106,193,0.35)] border border-r-0 border-white/20 z-40 group bg-[#8873b8] text-white hover:bg-[#7862aa] translate-x-2 hover:translate-x-0 rounded-l-xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2"
            title="Abrir panel de personas"
            aria-label="Abrir panel de personas"
          >
            <div className="floating-people-icon flex items-center justify-center">
              <FiUsers
                size={22}
                strokeWidth={1.7}
                className="group-hover:scale-110 transition-transform duration-200"
              />
            </div>
            <div className="floating-people-text-container flex items-center justify-center">
              <div className="floating-people-text text-xs font-bold">
                PERSONAS
              </div>
            </div>
          </button>
        )}

        {/* Botón flotante de personas para móvil y tablet - abajo a la derecha - solo cuando sidebar está cerrado */}
        {!showPeoplePanel && !isDesktop && !isSidebarOpen && !showSettings && (
          <button
            onClick={() => setShowPeoplePanel(true)}
            className={`fixed right-6 w-16 h-16 bg-[#8873b8] hover:bg-[#7862aa] text-white rounded-full border border-white/20 shadow-[0_0_12px_3px_rgba(121,78,184,0.48),0_0_32px_8px_rgba(139,106,193,0.35)] transition-all duration-300 flex items-center justify-center z-40 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 ${
              isChatOpen ? "bottom-36" : "bottom-6"
            }`}
            title="Abrir panel de personas"
          >
            <FiUsers
              size={28}
              strokeWidth={1.7}
              className="group-hover:scale-110 transition-transform duration-200"
            />
          </button>
        )}

        {/* Componente de Chat Personal */}
        {isChatOpen && (
          <PersonalChat
            userId={user.uid}
            isOpen={isChatOpen}
            isMinimized={isChatMinimized}
            onClose={handleChatClose}
            onToggleMinimize={handleChatMinimizeToggle}
          />
        )}
      </>
    </main>
  );
}
