'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import PersonalChat from '@/components/PersonalChat';
import PersonalChatButton from '@/components/PersonalChatButton';
import Auth from '@/components/Auth';
import Loading from '@/components/Loading';
import Settings from '@/components/Settings';
import PeopleManager from '@/components/PeopleManager';
import peopleStyles from '@/components/PeopleManager.module.css';
import { useAuth } from '@/hooks/useAuth';
import { useDiaryStore } from '@/lib/store';
import { FiMenu, FiEdit2, FiSave, FiX, FiMic, FiStopCircle, FiMessageCircle, FiUsers, FiUser, FiZap } from 'react-icons/fi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Image from 'next/image';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const { user, loading } = useAuth();
  
  const { 
    fetchCurrentEntry, 
    currentDate,
    currentEntry, 
    isLoading, 
    isEditing: storeIsEditing,
    saveCurrentEntry, 
    toggleEditMode: storeToggleEditMode
  } = useDiaryStore();
  
  const [isClient, setIsClient] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  
  // Estados del diario
  const [content, setContent] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStylizing, setIsStylizing] = useState(false);
  const [showPeoplePanel, setShowPeoplePanel] = useState(false); // Cambiado a false por defecto para mejor responsive
  const [peopleRefreshTrigger, setPeopleRefreshTrigger] = useState(0);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [mentionedPeople, setMentionedPeople] = useState<string[]>([]);
  
  // Estado para controlar el comportamiento responsive del panel de personas
  const [isDesktop, setIsDesktop] = useState(false);
  
  // Referencias del diario
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const lastUserId = useRef<string | null>(null);
  const recordingTimeout = useRef<NodeJS.Timeout | null>(null);

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
      contentLength: content.length
    };
    
    if (JSON.stringify(currentState) !== JSON.stringify(lastLoggedState.current)) {
      console.log('📝 DIARY: Estado actual:', currentState);
      lastLoggedState.current = currentState;
    }
  }, [currentEntry?.id, isLoading, storeIsEditing, showSettings, content.length]);

  // Solo loguear cambios significativos
  useEffect(() => {
    logStateChange();
  }, [logStateChange]);

  // Funciones del diario
  const handleToggleEditMode = () => {
    console.log('📝 DIARY: Toggle edit mode');
    
    // Si se está cancelando la edición, restaurar el contenido original
    if (storeIsEditing) {
      // Si hay una entrada, restaurar su contenido, si no hay entrada, limpiar el campo
      if (currentEntry) {
        setContent(currentEntry.content || '');
        setMentionedPeople(currentEntry.mentioned_people || []);
      } else {
        setContent('');
        setMentionedPeople([]);
      }
      setError(null);
    }
    
    storeToggleEditMode();
  };

  const handleSave = async () => {
    if (!user?.id) return;
    
    console.log('📝 DIARY: Guardando entrada...');
    try {
      await saveCurrentEntry(content, user.id);
      console.log('📝 DIARY: Entrada guardada exitosamente');
    } catch (error) {
      console.error('📝 DIARY: Error al guardar:', error);
      setError('Error al guardar la entrada');
    }
  };

  const handleStylize = async () => {
    if (!user?.id) return;
    
    console.log('📝 DIARY: Estilizando texto...');
    setIsStylizing(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch('/api/stylize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          text: content,
          userId: user.id,
          entryDate: currentEntry?.date || new Date().toISOString().split('T')[0]
        }),
      });

      if (!response.ok) {
        throw new Error('Error en la respuesta del servidor');
      }

      const data = await response.json();
      console.log('📝 DIARY: Respuesta de estilización:', data);
      
      if (data.stylizedText) {
        setContent(data.stylizedText);
        console.log('📝 DIARY: Texto estilizado exitosamente');
      } else {
        console.warn('📝 DIARY: No se recibió texto estilizado');
        setError('No se pudo estilizar el texto');
      }

      // Actualizar las personas mencionadas
      if (data.peopleExtracted && Array.isArray(data.peopleExtracted)) {
        const peopleNames = data.peopleExtracted.map((person: { name: string }) => person.name).filter(Boolean);
        setMentionedPeople(peopleNames);
        console.log('📝 DIARY: Personas extraídas:', peopleNames);
        
        // Disparar actualización del panel de personas si está abierto
        if (showPeoplePanel) {
          setPeopleRefreshTrigger(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('📝 DIARY: Error al estilizar:', error);
      setError('Error al estilizar el texto');
    } finally {
      setIsStylizing(false);
    }
  };

  const startRecording = async () => {
    const MAX_RECORDING_DURATION = 5 * 60 * 1000; // 5 minutos
    if (recordingTimeout.current) {
      clearTimeout(recordingTimeout.current);
    }

    console.log('📝 DIARY: Iniciando grabación...');
    setError(null);
    
    try {
      // Verificar si el navegador soporta getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta grabación de audio');
      }

      // Verificar si estamos en un contexto seguro (HTTPS o localhost)
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        throw new Error('La grabación de audio solo funciona en sitios seguros (HTTPS)');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Guardar referencia al stream
      currentStream.current = stream;
      
      // Verificar si MediaRecorder está disponible
      if (!window.MediaRecorder) {
        throw new Error('Tu navegador no soporta grabación de audio');
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      mediaRecorder.current = recorder;
      audioChunks.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { 
          type: recorder.mimeType || 'audio/webm' 
        });
        setAudioBlob(audioBlob);
        console.log('📝 DIARY: Grabación completada');
        
        // Detener todas las pistas del stream y limpiar la referencia
        if (currentStream.current) {
          currentStream.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
          currentStream.current = null;
        }
      };

      recorder.onerror = (event) => {
        console.error('📝 DIARY: Error en MediaRecorder:', event);
        setError('Error durante la grabación');
        setIsRecording(false);
      };

      recorder.start();
      setIsRecording(true);
      recordingTimeout.current = setTimeout(() => {
        stopRecording();
      }, MAX_RECORDING_DURATION);
    } catch (error) {
      console.error('📝 DIARY: Error al acceder al micrófono:', error);
      
      // Mensajes de error más específicos y claros
      let errorMessage = 'Error al acceder al micrófono';
      
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
            errorMessage = 'Micrófono bloqueado. Permite el acceso en tu navegador.';
            break;
          case 'NotFoundError':
            errorMessage = 'No se encontró micrófono. Verifica tu dispositivo.';
            break;
          case 'NotReadableError':
            errorMessage = 'Micrófono ocupado por otra aplicación.';
            break;
          case 'OverconstrainedError':
            errorMessage = 'Configuración de audio no compatible.';
            break;
          default:
            errorMessage = `Error del navegador: ${error.message}`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    console.log('📝 DIARY: Deteniendo grabación...');
    
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop();
      setIsRecording(false);
    } else {
      console.warn('📝 DIARY: No hay grabación activa para detener');
      setIsRecording(false);
      if (recordingTimeout.current) {
        clearTimeout(recordingTimeout.current);
        recordingTimeout.current = null;
      }
    }
    
    // Detener el stream independientemente
    if (currentStream.current) {
      currentStream.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      currentStream.current = null;
    }
  };

  const processTranscription = useCallback(async () => {
    if (!audioBlob || !user?.id) return;

    console.log('📝 DIARY: Procesando transcripción...');
    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.wav');
      formData.append('userId', user.id);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Error en la transcripción');
      }

      const data = await response.json();
      
      if (data.text) {
        const newContent = content + (content ? '\n\n' : '') + data.text;
        setContent(newContent);
        console.log('📝 DIARY: Transcripción procesada exitosamente:', data.text);
      } else {
        console.warn('📝 DIARY: No se recibió texto de la transcripción');
      }
    } catch (error) {
      console.error('📝 DIARY: Error en transcripción:', error);
      setError('Error al procesar la transcripción');
    } finally {
      setIsProcessing(false);
      setAudioBlob(null);
    }
  }, [audioBlob, user?.id, content]);

  // Sincronizar content con currentEntry
  useEffect(() => {
    if (currentEntry?.content !== undefined) {
      setContent(currentEntry.content || '');
      console.log('📝 DIARY: Contenido sincronizado desde currentEntry');
      
      // También sincronizar las personas mencionadas
      if (currentEntry?.mentioned_people) {
        setMentionedPeople(currentEntry.mentioned_people);
      } else {
        setMentionedPeople([]);
      }
    } else if (currentEntry === null) {
      // Si no hay entrada para esta fecha, limpiar el contenido
      setContent('');
      setMentionedPeople([]);
      setError(null);
      
      console.log('📝 DIARY: Contenido limpiado - no hay entrada para esta fecha');
    }
  }, [currentEntry]);

  // Función para manejar click en personas mencionadas
  const handlePersonClick = (personName: string) => {
    setSelectedPersonId(personName);
    setShowPeoplePanel(true);
    console.log('📝 DIARY: Seleccionada persona:', personName);
  };

  // Procesar transcripción cuando hay audioBlob
  useEffect(() => {
    if (audioBlob && !isProcessing) {
      processTranscription();
    }
  }, [audioBlob, isProcessing, processTranscription]);

  // Funciones para manejar el chat personal
  const handleChatToggle = () => {
    if (isChatOpen) {
      setIsChatOpen(false);
      setIsChatMinimized(false);
    } else {
      setIsChatOpen(true);
      setIsChatMinimized(false);
    }
  };

  const handleChatClose = () => {
    setIsChatOpen(false);
    setIsChatMinimized(false);
  };

  const handleChatMinimizeToggle = () => {
    setIsChatMinimized(!isChatMinimized);
  };

  const handleAuthSuccess = (authenticatedUser: User) => {
    // El hook useAuth se encargará de actualizar el estado
    console.log('Usuario autenticado:', authenticatedUser.id);
  };
  
  // Obtener los datos de la entrada actual cuando cambia la fecha o el usuario
  useEffect(() => {
    if (isClient && user?.id) {
      fetchCurrentEntry(user.id);
    }
  }, [fetchCurrentEntry, isClient, currentDate, user?.id]);

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
    window.addEventListener('resize', checkScreenSize);
    
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []); // Sin dependencias porque solo necesita ejecutarse una vez

  // Limpiar errores automáticamente después de 5 segundos
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [error]);

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
  if (user?.id && user.id !== lastUserId.current) {
    console.log('🎯 PAGE: Renderizando aplicación para user:', user.id);
    lastUserId.current = user.id;
  }

  return (
    <main className="flex min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 overflow-hidden">
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
          ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} 
          md:translate-x-0 md:shadow-xl md:w-[420px] w-[85%] max-w-md
          bg-white/95 backdrop-blur-xl border-r border-white/20
        `}
      >
        {/* El botón X se moverá al componente Sidebar para superponerse */}
        <div className="overflow-y-auto h-full">
          <Sidebar 
            userId={user.id} 
            onClose={() => setIsSidebarOpen(false)} 
            onSettingsClick={() => {
              setShowSettings(true);
              // Auto-cerrar sidebar en móvil al abrir configuración
              setIsSidebarOpen(false);
            }}
            onDateChange={() => {
              setShowSettings(false);
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
          <div className="ml-4">
            <Image src="/image/Logo-entero-SecondBrain.png" alt="SecondBrain Logo" width={120} height={24} priority />
          </div>
        </header>
        
        {/* Área principal */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {/* Renderizar vista de configuración */}
          {showSettings ? (
            <div className="max-w-7xl mx-auto">
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200/60 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 sticky top-0 z-10">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    <span className="text-slate-800 text-xl font-semibold">Configuración</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button 
                      onClick={() => setShowSettings(false)}
                      className="flex items-center space-x-2 px-4 py-2 bg-white/80 text-slate-700 rounded-xl hover:bg-white transition-all duration-200 shadow-sm border border-white/40"
                    >
                      <span>Volver al diario</span>
                    </button>
                  </div>
                </div>
                <Settings userId={user.id} />
              </div>
            </div>
          ) : (
            /* Vista principal del diario */
            <div className="max-w-7xl mx-auto h-full">
              <div className="flex gap-6 h-full relative">
                {/* Contenido principal del diario - siempre toma el espacio completo */}
                <div className="flex-1 bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                  
                  {/* Barra de herramientas unificada - Responsive layout */}
                  <div className="border-b border-slate-200/60 bg-gradient-to-r from-indigo-50 to-purple-50 sticky top-0 z-10">
                    
                    {/* Layout móvil - fecha arriba, botones abajo en la misma barra */}
                    <div className="md:hidden">
                      {/* Fecha */}
                      <div className="p-4 pb-3 text-center">
                        <div className="flex items-center justify-center space-x-3">
                          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                          <span className="text-slate-600 text-sm font-medium">
                            {currentEntry?.date
                              ? format(new Date(currentEntry.date), "EEEE, d 'de' MMMM", { locale: es })
                              : "Nueva entrada"}
                          </span>
                        </div>
                      </div>
                      
                      {/* Botones móvil - tamaño original pero sin flex-wrap */}
                      <div className="px-4 pb-4">
                        <div className="flex items-center justify-center space-x-3 overflow-x-auto">
                          {storeIsEditing ? (
                            <>
                              <button 
                                onClick={handleStylize}
                                disabled={isStylizing || !content}
                                className={`flex items-center space-x-2 px-3 py-2 rounded-xl transition-all duration-200 ${isStylizing ? 'bg-indigo-400' : 'bg-indigo-500'} text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-sm font-medium whitespace-nowrap`}
                                title="Estilizar con IA"
                              >
                                <FiZap size={16} />
                                <span>Estilizar</span>
                              </button>
                              
                              <button 
                                onClick={handleSave}
                                className="flex items-center space-x-2 px-3 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all duration-200 shadow-lg text-sm font-medium whitespace-nowrap"
                              >
                                <FiSave size={16} />
                                <span>Guardar</span>
                              </button>
                              
                              <button 
                                onClick={handleToggleEditMode}
                                className="flex items-center space-x-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all duration-200 border border-slate-200 text-sm font-medium whitespace-nowrap"
                              >
                                <FiX size={16} />
                                <span>Cancelar</span>
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={handleToggleEditMode}
                              className="flex items-center space-x-2 px-3 py-2 bg-slate-50 text-slate-700 rounded-xl hover:bg-slate-100 transition-all duration-200 border border-slate-200 text-sm font-medium whitespace-nowrap"
                              disabled={isRecording || isProcessing}
                            >
                              <FiEdit2 size={16} />
                              <span>Editar</span>
                            </button>
                          )}
                          
                          {/* Botón de grabación siempre visible (como en desktop) */}
                          {!isRecording ? (
                            <button
                              onClick={startRecording}
                              disabled={isProcessing}
                              className="flex items-center space-x-2 px-3 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-sm font-medium whitespace-nowrap"
                              title="Iniciar grabación"
                            >
                              <FiMic size={16} />
                              <span>Grabar</span>
                            </button>
                          ) : (
                            <button
                              onClick={stopRecording}
                              className="flex items-center space-x-2 px-3 py-2 bg-slate-700 text-white rounded-xl hover:bg-slate-800 transition-all duration-200 shadow-lg animate-pulse text-sm font-medium whitespace-nowrap"
                              title="Detener grabación"
                            >
                              <FiStopCircle size={16} />
                              <span>Detener</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Layout desktop - inline como antes */}
                    <div className="hidden md:flex items-center justify-between p-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                        <span className="text-slate-600 text-sm font-medium">
                          {currentEntry?.date
                            ? format(new Date(currentEntry.date), "EEEE, d 'de' MMMM", { locale: es })
                            : "Nueva entrada"}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {storeIsEditing ? (
                        <>
                          <button 
                            onClick={handleStylize}
                            disabled={isStylizing || !content}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-200 ${isStylizing ? 'bg-indigo-400' : 'bg-indigo-500'} text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg`}
                            title="Estilizar con IA"
                          >
                            <FiZap size={18} />
                            <span className="font-medium">Estilizar</span>
                          </button>
                          
                          <button 
                            onClick={handleSave}
                            className="flex items-center space-x-2 px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all duration-200 shadow-lg"
                          >
                            <FiSave size={18} />
                            <span className="font-medium">Guardar</span>
                          </button>
                          
                          <button 
                            onClick={handleToggleEditMode}
                            className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all duration-200 border border-slate-200"
                          >
                            <FiX size={18} />
                            <span className="font-medium">Cancelar</span>
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={handleToggleEditMode}
                          className="flex items-center space-x-2 px-4 py-2 bg-slate-50 text-slate-700 rounded-xl hover:bg-slate-100 transition-all duration-200 border border-slate-200"
                          disabled={isRecording || isProcessing}
                        >
                          <FiEdit2 size={18} />
                          <span className="font-medium">Editar</span>
                        </button>
                      )}
                      
                      {!storeIsEditing && (
                        <>
                          {!isRecording ? (
                            <button
                              onClick={startRecording}
                              disabled={isProcessing}
                              className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                              title="Iniciar grabación"
                            >
                              <FiMic size={18} />
                              <span className="font-medium">Grabar</span>
                            </button>
                          ) : (
                            <button
                              onClick={stopRecording}
                              className="flex items-center space-x-2 px-4 py-2 bg-slate-700 text-white rounded-xl hover:bg-slate-800 transition-all duration-200 shadow-lg animate-pulse"
                              title="Detener grabación"
                            >
                              <FiStopCircle size={18} />
                              <span className="font-medium">Detener</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                
                  {/* Contenido principal mejorado */}
                  <div className="relative">
                    {/* Mensajes de error mejorados */}
                    {error && (
                      <div className="m-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center space-x-3">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span>{error}</span>
                      </div>
                    )}
                    
                    {/* Indicador de procesamiento mejorado */}
                    {isProcessing && audioBlob && (
                      <div className="m-6 p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-sm flex items-center space-x-3">
                        <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="font-medium">Procesando transcripción...</span>
                      </div>
                    )}
                    
                    {/* Indicador de estilización mejorado */}
                    {isStylizing && (
                      <div className="m-6 p-4 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-sm flex items-center space-x-3">
                        <svg className="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="font-medium">Estilizando texto con IA...</span>
                      </div>
                    )}
                    
                    {/* Editor/Visualizador de contenido mejorado - márgenes reducidos en móvil */}
                    <div className="p-4 md:p-8 min-h-[600px]">
                      {storeIsEditing ? (
                        <div className="relative">
                          <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Escribe tu entrada del diario aquí... ✨"
                            className="w-full h-[500px] p-4 md:p-6 border-2 border-slate-200 rounded-2xl resize-none focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400 text-slate-700 leading-relaxed text-lg bg-white/50 backdrop-blur-sm transition-all duration-200"
                          />
                          <div className="absolute bottom-4 right-4 text-xs text-slate-400">
                            {content.length} caracteres
                          </div>
                        </div>
                      ) : (
                        <div className="prose prose-slate prose-lg max-w-none">
                          {content ? (
                            <div 
                              className="whitespace-pre-wrap text-slate-700 leading-relaxed text-lg bg-slate-50/50 p-4 md:p-6 rounded-2xl border border-slate-200/60 cursor-pointer hover:bg-slate-100/50 transition-all duration-200"
                              onClick={handleToggleEditMode}
                              title="Haz clic para editar"
                            >
                              {content}
                            </div>
                          ) : (
                            <div 
                              className="text-center py-24 cursor-pointer hover:bg-slate-50/50 rounded-2xl transition-all duration-200"
                              onClick={handleToggleEditMode}
                              title="Haz clic para comenzar a escribir"
                            >
                              <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <FiEdit2 className="text-indigo-500 text-2xl" />
                              </div>
                              <h3 className="text-slate-400 text-xl font-medium mb-2">Tu diario está esperando</h3>
                              <p className="text-slate-400">Haz clic aquí para comenzar a escribir tu día.</p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Sección de personas mencionadas */}
                      {mentionedPeople.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-slate-200/60">
                          <div className="flex items-center space-x-3 mb-4">
                            <FiUser className="text-purple-500" size={18} />
                            <h4 className="text-slate-700 font-medium">Personas mencionadas</h4>
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
                                <span className="text-sm font-medium">{person}</span>
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
                        <span className="text-slate-800 text-lg font-semibold">Personas</span>
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
                        userId={user.id} 
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
                  
                  {/* Contenedor del modal con posicionamiento fijo robusto usando CSS module */}
                  <div className={`${peopleStyles.mobileModalContainer} fixed inset-0 w-full h-full bg-white z-50 overflow-hidden md:hidden`}>
                    {/* Header fijo en la parte superior */}
                    <div className={`${peopleStyles.mobileModalHeader} bg-gradient-to-r from-purple-50 to-pink-50`}>
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <FiUsers className="text-purple-600" size={20} />
                        <span className="text-slate-800 text-lg font-semibold">Personas</span>
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
                    
                    {/* Área de contenido con scroll independiente */}
                    <div className={peopleStyles.mobileContentArea}>
                      <PeopleManager 
                        userId={user.id} 
                        refreshTrigger={peopleRefreshTrigger} 
                        className="shadow-none"
                        initialSelectedName={selectedPersonId}
                      />
                    </div>
                  </div>
                  
                  {/* Versión tablet/desktop más grande */}
                  <div className="hidden md:flex fixed inset-0 z-50 items-start justify-center p-4 pt-16 pointer-events-none">
                    <div 
                      className="w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-white/20 overflow-hidden animate-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between border-b border-slate-200/60 p-6 bg-gradient-to-r from-purple-50 to-pink-50 sticky top-0 z-10">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          <FiUsers className="text-purple-600" size={20} />
                          <span className="text-slate-800 text-lg font-semibold">Personas</span>
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
                      
                      <div className="flex-1 overflow-y-auto p-6 max-h-[calc(90vh-80px)]">
                        <PeopleManager 
                          userId={user.id} 
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
            </div>
          )}
        </div>
      </div>

      {/* Botones flotantes */}
      <>
        {/* Botón del Chat Personal para Desktop - al lado del sidebar */}
        {!isChatOpen && (
          <PersonalChatButton 
            onClick={handleChatToggle}
            isActive={false}
            className="hidden md:flex"
          />
        )}

        {/* Botón del Chat Personal para Móvil e iPad - más visible - solo cuando sidebar está cerrado */}
        {!isChatOpen && !isSidebarOpen && (
          <button
            onClick={handleChatToggle}
            title="Chat Personal"
            className="fixed bottom-6 left-6 z-40 md:hidden
              flex flex-col items-center justify-center w-16 h-20
              bg-gradient-to-br from-purple-500 to-blue-600 
              hover:from-purple-600 hover:to-blue-700
              text-white shadow-xl hover:shadow-2xl
              rounded-2xl transition-all duration-300 hover:scale-105"
          >
            <div className="relative mb-1">
              <FiMessageCircle size={20} />
            </div>
            <span className="font-bold text-xs text-center leading-tight">CHAT</span>
            <span className="font-medium text-[10px] text-center leading-tight opacity-90">Personal</span>
          </button>
        )}

        {/* Botón flotante de personas para escritorio - solo visible cuando el panel está cerrado */}
        {!showPeoplePanel && isDesktop && (
          <button
            onClick={() => setShowPeoplePanel(true)}
            className="fixed top-1/2 right-0 transform -translate-y-1/2 w-14 h-32 flex flex-col items-center justify-center transition-all duration-300 shadow-lg z-40 group bg-purple-500 text-white hover:bg-purple-600 translate-x-2 hover:translate-x-0 rounded-l-xl p-1"
            title="Abrir panel de personas"
            aria-label="Abrir panel de personas"
          >
            <div className="floating-people-icon flex items-center justify-center">
              <FiUsers
                size={20}
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
        {!showPeoplePanel && !isDesktop && !isSidebarOpen && (
          <button
            onClick={() => setShowPeoplePanel(true)}
            className={`fixed right-6 w-16 h-16 bg-purple-500 hover:bg-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-40 group ${
              isChatOpen ? 'bottom-36' : 'bottom-6'
            }`}
            title="Abrir panel de personas"
          >
            <FiUsers size={28} className="group-hover:scale-110 transition-transform duration-200" />
          </button>
        )}

        {/* Componente de Chat Personal */}
        {isChatOpen && (
          <PersonalChat
            userId={user.id}
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
