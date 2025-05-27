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
  FiStopCircle,
  FiVolume2,
  FiZap
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
  const [error, setError] = useState<string | null>(null);
  const [isStylizing, setIsStylizing] = useState(false);
  
  // Referencias
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
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
  
  // Estilizar el texto con ChatGPT
  const handleStylize = async () => {
    if (!content || content.trim() === '') {
      setError('No hay contenido para estilizar');
      return;
    }
    
    try {
      setIsStylizing(true);
      setError(null);
      
      console.log('⭐ Enviando texto a estilizar...');
      
      const response = await fetch('/api/stylize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: content }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al estilizar el texto');
      }
      
      const data = await response.json() as StylizeResponse;
      console.log('✅ Texto estilizado recibido');
      
      // Actualizar el contenido con el texto estilizado
      setContent(data.stylizedText);
      
      // Dar feedback visual al usuario
      const stylizeElement = document.createElement('div');
      stylizeElement.className = 'fixed bottom-6 right-6 bg-purple-500 text-white px-4 py-2 rounded-full z-50';
      stylizeElement.textContent = 'Texto estilizado correctamente';
      document.body.appendChild(stylizeElement);
      
      setTimeout(() => {
        if (document.body.contains(stylizeElement)) {
          document.body.removeChild(stylizeElement);
        }
      }, 3000);
      
    } catch (err) {
      console.error('❌ Error al estilizar:', err);
      setError(`No se pudo estilizar el texto: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setIsStylizing(false);
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

  // Interfaces para las respuestas de las APIs
  interface TranscriptionResponse {
    text: string;
  }
  
  interface StylizeResponse {
    stylizedText: string;
  }

  
  // Iniciar grabación
  const startRecording = async () => {
    try {
      // Reiniciar estados
      setAudioBlob(null);
      setError(null);
      audioChunksRef.current = [];
      
      console.log('⭐ Solicitando permisos de micrófono...');
      
      // Configurar con mejor calidad de audio
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000, // Calidad de estudio
          channelCount: 1      // Mono
        }
      });
      console.log('⭐ Permisos de micrófono concedidos.');

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus', // Formato recomendado para calidad y compatibilidad
        audioBitsPerSecond: 128000 // 128 kbps para buena calidad de voz
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('📦 Chunk de audio recibido, tamaño:', event.data.size);
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log('ONSTOP: Grabación finalizada. Fragmentos:', audioChunksRef.current.length);

        if (audioChunksRef.current.length === 0) {
          console.log('ONSTOP: No se capturó audio.');
          setError('No se capturó audio. Intenta de nuevo.');
          setAudioBlob(null); 
          return;
        }

        const newAudioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        audioChunksRef.current = []; 

        if (newAudioBlob.size === 0) { 
            console.log('ONSTOP: Se creó un blob de audio vacío.');
            setError('Se creó un blob de audio vacío, no se puede transcribir.');
            setAudioBlob(null);
            return;
        }
        
        console.log('ONSTOP: Audio blob creado, tamaño:', newAudioBlob.size, 'bytes');
        // Detener las pistas del stream actual ANTES de procesar la transcripción
        // y antes de que un nuevo stream pueda ser creado por otra llamada a startRecording.
        stream.getTracks().forEach(track => track.stop());
        console.log('ONSTOP: Pistas de stream detenidas.');

        // Siempre transcribir el audio cuando la grabación se detenga
        console.log('ONSTOP: Iniciando transcripción automática...');
        setAudioBlob(newAudioBlob); // Para el indicador "Procesando..."
        setError(null);
        setIsProcessing(true);
        processTranscription(newAudioBlob);
      };
      
      mediaRecorder.start(); // Iniciar grabación (por defecto, ondataavailable se llama cuando se detiene o según timeslice)
      // Para obtener chunks periódicamente, se podría usar mediaRecorder.start(1000); si fuera necesario.
      setIsRecording(true);
      console.log('START_RECORDING: Grabación iniciada, isRecording=true');
      
      // Limitar la grabación a 60 segundos máximo
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          console.log('TIMEOUT: Tiempo máximo de grabación alcanzado (1 minuto). Deteniendo automáticamente.');
          stopRecording(); // Esto llamará a mediaRecorder.stop() que a su vez disparará onstop.
        }
      }, 60000); // 60 segundos 
      
    } catch (err) {
      console.error('START_RECORDING_ERROR: Error al iniciar la grabación:', err);
      setError('No se pudo iniciar la grabación. Verifica los permisos del micrófono.');
      setIsRecording(false);
    }
  };
  
  // Detener grabación
  const stopRecording = () => {
    console.log('STOP_RECORDING: Intentando detener. MediaRecorder:', !!mediaRecorderRef.current, 'IsRecording:', isRecording);
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop(); 
      setIsRecording(false);
      console.log('STOP_RECORDING: MediaRecorder.stop() llamado, isRecording set to false.');
    } else {
      console.log('STOP_RECORDING: No hay grabador activo o no se está grabando.');
    }
  };

  // Procesar la transcripción
  const processTranscription = async (blobToProcess: Blob) => {
    console.log('PROCESS_TRANSCRIPTION: Iniciando transcripción de audio...');
    console.log('PROCESS_TRANSCRIPTION: Tamaño del audio:', blobToProcess.size, 'bytes, tipo:', blobToProcess.type);
    
    try {
      
      const audioFile = new File(
        [blobToProcess], 
        `recording-${Date.now()}.webm`, 
        { type: 'audio/webm;codecs=opus' }
      );
      
      const formData = new FormData();
      formData.append('file', audioFile);
      
      console.log('⭐ Enviando archivo a API:', audioFile.name, audioFile.type, audioFile.size, 'bytes');
      
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al procesar la transcripción');
      }
      
      const data = await response.json() as TranscriptionResponse;
      console.log('✅ Transcripción recibida:', data.text);
      
      if (!data.text || data.text.trim() === '') {
        throw new Error('La transcripción está vacía. Intenta hablar más cerca del micrófono.');
      }
      
      if (!storeIsEditing) {
        storeToggleEditMode();
      }
      
      console.log('PROCESS_TRANSCRIPTION_SUCCESS: Intentando actualizar contenido con texto:', data.text);
      const textToAdd = data.text;
      // Actualizar el estado local 'content' del editor
      setContent(prevContent => 
        prevContent ? `${prevContent}\n${textToAdd}` : textToAdd
      );
      console.log('PROCESS_TRANSCRIPTION_SUCCESS: Estado de contenido local actualizado.');
      
      // El audioBlob (estado) se limpiará en el finally.
      
      const transcriptionElement = document.createElement('div');
      transcriptionElement.className = 'fixed bottom-6 right-6 bg-green-500 text-white px-4 py-2 rounded-full z-50';
      transcriptionElement.textContent = 'Transcripción completada y añadida al editor.';
      document.body.appendChild(transcriptionElement);
      
      setTimeout(() => {
        if (document.body.contains(transcriptionElement)) {
          document.body.removeChild(transcriptionElement);
        }
      }, 3000);
      
    } catch (err) {
      console.error('❌ Error en la transcripción:', err);
      setError(`No se pudo realizar la transcripción: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      console.log('PROCESS_TRANSCRIPTION_FINALLY: Inicio del bloque finally.');
      setIsProcessing(false);
      setAudioBlob(null); 
      console.log('PROCESS_TRANSCRIPTION_FINALLY: Fin del bloque finally. isProcessing y audioBlob reseteados.');
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
                {/* Botón de estilización con IA */}
                <button 
                  onClick={handleStylize}
                  disabled={isStylizing || !content}
                  className={`flex items-center space-x-1 px-3 py-1.5 ${isStylizing ? 'bg-purple-400' : 'bg-purple-500'} text-white rounded-md hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                  title="Estilizar con IA"
                >
                  <FiZap size={16} />
                  <span>Estilizar</span>
                </button>
                
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
                    disabled={isProcessing}
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
              </>
            )}
          </div>
        </div>
        
        {/* Contenido principal */}
        <div className="relative">
          {/* Mensajes de error */}
          {error && (
            <div className="m-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}
          
          {/* Indicador de procesamiento de transcripción */}
          {isProcessing && audioBlob && (
            <div className="m-4 p-3 bg-blue-100 border border-blue-300 text-blue-700 rounded-md text-sm flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Procesando transcripción...
            </div>
          )}
          
          {/* Indicador de estilización */}
          {isStylizing && (
            <div className="m-4 p-3 bg-purple-100 border border-purple-300 text-purple-700 rounded-md text-sm flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Estilizando texto con IA...
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
          
          {/* Estado de grabación */}
          {isRecording && (
            <div className="fixed bottom-6 right-6 bg-red-600 text-white px-5 py-3 rounded-full flex items-center space-x-3 shadow-lg z-50">
              <div className="w-4 h-4 bg-white rounded-full animate-ping"></div>
              <div className="w-4 h-4 bg-white rounded-full absolute ml-0"></div>
              <span className="font-medium text-lg">Grabando...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntegratedDiary;
