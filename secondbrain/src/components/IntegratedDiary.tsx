import React, { useState, useRef } from 'react';
import { useDiaryStore } from '@/lib/store';
import { saveAudioTranscription } from '@/lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  FiEdit2, 
  FiSave, 
  FiX, 
  FiMic,
  FiPause,
  FiPlay,
  FiStopCircle,
  FiVolume2
} from 'react-icons/fi';

interface IntegratedDiaryProps {
  userId: string;
}

const IntegratedDiary: React.FC<IntegratedDiaryProps> = ({ userId }) => {
  const { 
    currentEntry, 
    isLoading, 
    isEditing: storeIsEditing,
    saveCurrentEntry, 
    fetchCurrentEntry,
    fetchTranscriptions,
    toggleEditMode: storeToggleEditMode,
    transcriptions
  } = useDiaryStore();
  
  // Estado para el contenido del editor
  const [content, setContent] = useState('');
  
  // Estados para la grabación de audio
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Referencias
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Efectos para sincronizar el estado con la entrada actual
  React.useEffect(() => {
    if (currentEntry) {
      setContent(currentEntry.content || '');
    } else {
      setContent('');
    }
    
    // Reset audio recording state when entry changes
    setAudioBlob(null);
    setIsProcessing(false);
    setIsRecording(false);
    setError(null);
  }, [currentEntry]);
  
  // Obtener los datos de la entrada cuando cambia el componente
  React.useEffect(() => {
    fetchCurrentEntry(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // FUNCIONES PARA EDITOR -----
  
  const handleSave = async () => {
    console.log('⭐ Iniciando guardado...');
    console.log('⭐ Contenido a guardar:', content);
    console.log('⭐ Usuario:', userId);
    console.log('⭐ Entrada actual:', currentEntry);
    
    try {
      await saveCurrentEntry(content, userId);
      console.log('✅ Guardado completado exitosamente');
    } catch (error) {
      console.error('❌ Error al guardar:', error);
    }
  };
  
  const handleToggleEditMode = () => {
    if (storeIsEditing) {
      // Cancelar edición y restaurar contenido original
      setContent(currentEntry?.content || '');
    }
    storeToggleEditMode();
    
    // Focus textarea when entering edit mode
    if (!storeIsEditing && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  };
  
  // FUNCIONES PARA GRABACIÓN DE AUDIO -----
  
  // Iniciar grabación
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        
        // Detener los tracks de audio
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      console.error('Error al iniciar la grabación:', err);
      setError('No se pudo acceder al micrófono. Verifica los permisos.');
    }
  };
  
  // Detener grabación
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  
  // Reproducir audio grabado
  const playAudio = () => {
    if (audioBlob && audioPlayerRef.current) {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };
  
  // Pausar reproducción
  const pauseAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    }
  };
  
  // Procesar la transcripción
  const processTranscription = async () => {
    if (!audioBlob || !currentEntry) {
      setError('No hay audio para transcribir o no hay entrada del diario actual.');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Crear un objeto FormData para enviar el archivo
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.wav');
      formData.append('entryId', currentEntry.id);
      
      // Enviar a la API de transcripción
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Error al procesar la transcripción');
      }
      
      const data = await response.json();
      
      // Guardar la transcripción en Supabase
      await saveAudioTranscription(
        currentEntry.id,
        data.audioUrl,
        data.text
      );
      
      // Actualizar la lista de transcripciones
      fetchTranscriptions();
      
      // Limpiar el estado
      setAudioBlob(null);
    } catch (err) {
      console.error('Error en la transcripción:', err);
      setError('No se pudo realizar la transcripción. Inténtalo de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  // RENDERIZADO CONDICIONAL -----
  
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md flex flex-col justify-center items-center p-8 min-h-[50vh]">
        <div className="w-12 h-12 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 text-lg">Cargando entrada...</p>
      </div>
    );
  }

  // Mensaje cuando no hay entrada
  const NoEntryMessage = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <svg className="w-20 h-20 text-slate-300 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
      </svg>
      <h2 className="text-xl font-semibold text-slate-700 mb-2">No hay entrada para esta fecha</h2>
      <p className="text-slate-500 max-w-md">
        Selecciona una fecha en el calendario o comienza a escribir para crear una entrada nueva.
      </p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Barra de herramientas */}
        <div className="flex items-center justify-between border-b border-slate-200 p-4 bg-white sticky top-0 z-10">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 text-sm font-medium">
              {currentEntry?.date
                ? format(new Date(currentEntry.date), "EEEE, d 'de' MMMM", { locale: es })
                : "Nueva entrada"}
            </span>
          </div>
          
          <div className="flex items-center space-x-3">
            {storeIsEditing ? (
              <>
                <button 
                  onClick={handleSave}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                >
                  <FiSave size={16} />
                  <span>Guardar</span>
                </button>
                <button 
                  onClick={handleToggleEditMode}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 transition-colors"
                >
                  <FiX size={16} />
                  <span>Cancelar</span>
                </button>
              </>
            ) : (
              <button 
                onClick={handleToggleEditMode}
                className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors"
                disabled={isRecording || isProcessing}
              >
                <FiEdit2 size={16} />
                <span>Editar</span>
              </button>
            )}
            
            {!storeIsEditing && (
              <>
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    disabled={isProcessing || !currentEntry}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Iniciar grabación"
                  >
                    <FiMic size={16} />
                    <span>Grabar</span>
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-slate-700 text-white rounded-md hover:bg-slate-800 transition-colors"
                    title="Detener grabación"
                  >
                    <FiStopCircle size={16} />
                    <span>Detener</span>
                  </button>
                )}
                
                {audioBlob && !isRecording && (
                  <>
                    <button
                      onClick={isPlaying ? pauseAudio : playAudio}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                      title={isPlaying ? "Pausar" : "Reproducir"}
                    >
                      {isPlaying ? <FiPause size={16} /> : <FiPlay size={16} />}
                      <span>{isPlaying ? "Pausar" : "Reproducir"}</span>
                    </button>
                    
                    <button
                      onClick={processTranscription}
                      disabled={isProcessing}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          <span>Procesando...</span>
                        </>
                      ) : (
                        <>
                          <FiVolume2 size={16} />
                          <span>Transcribir</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Contenido principal */}
        <div className="relative">
          {/* Audio grabado oculto */}
          {audioBlob && (
            <audio
              ref={audioPlayerRef}
              src={URL.createObjectURL(audioBlob)}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          )}
          
          {/* Mensajes de error */}
          {error && (
            <div className="m-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}
          
          {/* Área de edición o visualización */}
          <div className="p-4">
            {storeIsEditing ? (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full min-h-[40vh] p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow resize-none"
                placeholder="Escribe tus pensamientos, reflexiones o tareas del día..."
              />
            ) : (
              <div className="min-h-[40vh]">
                {!currentEntry ? (
                  <NoEntryMessage />
                ) : content ? (
                  <div className="prose prose-slate max-w-none">
                    {content.split('\n').map((line, i) => (
                      <React.Fragment key={i}>
                        {line}
                        {i < content.split('\n').length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                    <p className="text-slate-500">
                      No hay contenido para esta entrada.<br />
                      Haz clic en "Editar" para comenzar a escribir.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Transcripciones integradas */}
          {transcriptions && transcriptions.length > 0 && !storeIsEditing && (
            <div className="border-t border-slate-200 p-4">
              <h3 className="text-lg font-medium text-slate-700 mb-3">Transcripciones</h3>
              <div className="space-y-4">
                {transcriptions.map((transcription) => (
                  <div 
                    key={transcription.id} 
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <div className="flex items-start">
                      <FiVolume2 className="text-blue-500 mt-1 mr-3 flex-shrink-0" size={18} />
                      <div className="flex-1">
                        <p className="text-xs text-slate-500 font-medium">
                          {format(
                            new Date(transcription.created_at), 
                            "d 'de' MMMM, HH:mm", 
                            { locale: es }
                          )}
                        </p>
                        <div className="mt-1 text-slate-700 text-sm">
                          {transcription.transcription.split('\n').map((line, index, array) => (
                            <React.Fragment key={index}>
                              {line}
                              {index < array.length - 1 && <br />}
                            </React.Fragment>
                          ))}
                        </div>
                        
                        {transcription.audio_url && (
                          <div className="mt-2">
                            <audio 
                              src={transcription.audio_url} 
                              controls 
                              className="w-full h-8 text-sm"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Estado de grabación */}
          {isRecording && (
            <div className="fixed bottom-6 right-6 bg-red-500 text-white px-4 py-2 rounded-full flex items-center space-x-2 animate-pulse">
              <div className="w-3 h-3 bg-white rounded-full"></div>
              <span>Grabando...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntegratedDiary;
