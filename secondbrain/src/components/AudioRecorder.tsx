import React, { useState, useRef, useEffect } from 'react';
import { useDiaryStore } from '@/lib/store';
import { FaMicrophone, FaStop, FaPlay, FaPause } from 'react-icons/fa';
import { saveAudioTranscription } from '@/lib/supabase-operations';
import { transcribeAudio } from '@/lib/transcription-client';
import { RECORDING_OPTIONS, RECORDING_LIMIT_NOTICE, recordingTime, startLimitedRecording } from '@/lib/audio-recording';


// Este componente actualmente no necesita props
type AudioRecorderProps = Record<string, never>;

const AudioRecorder: React.FC<AudioRecorderProps> = () => {
  const { currentEntry, fetchTranscriptions } = useDiaryStore();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingNotice, setRecordingNotice] = useState<string | null>(null);
  const autoTranscribe = useRef(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const cancelRecordingTimer = useRef<(() => void) | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeEntryId = useRef(currentEntry?.id);
  activeEntryId.current = currentEntry?.id;

  useEffect(() => {
    if (!audioBlob) { setAudioUrl(null); return; }
    const url = URL.createObjectURL(audioBlob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioBlob]);

  useEffect(() => {
    setAudioBlob(null);
    setIsRecording(false);
    setRecordingNotice(null);
    autoTranscribe.current = false;
    return () => {
      cancelRecordingTimer.current?.();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.ondataavailable = null;
        recorder.stop();
      }
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, [currentEntry?.id]);
  
  // Iniciar grabación
  const startRecording = async () => {
    const entryId = activeEntryId.current;
    if (!entryId) return;
    if (isProcessing || audioBlob || mediaRecorderRef.current?.state === 'recording') return;
    setRecordingNotice(null);
    autoTranscribe.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (activeEntryId.current !== entryId) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, RECORDING_OPTIONS);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        cancelRecordingTimer.current?.();
        setIsRecording(false);
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || audioChunksRef.current[0]?.type || 'audio/webm' });
        setAudioBlob(audioBlob);
        
        // Detener los tracks de audio
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      };
      
      cancelRecordingTimer.current = startLimitedRecording(mediaRecorder, setRecordingSeconds, () => {
        autoTranscribe.current = true;
        setRecordingNotice(RECORDING_LIMIT_NOTICE);
      });
      setIsRecording(true);
      setError(null);
    } catch (err) {
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      console.error('Error al iniciar la grabación:', err);
      setError('No se pudo acceder al micrófono. Verifica los permisos.');
    }
  };
  
  // Detener grabación
  const stopRecording = () => {
    cancelRecordingTimer.current?.();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
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
      const data = await transcribeAudio(audioBlob);
      if (activeEntryId.current !== currentEntry.id) return;
      
      // Guardar la transcripción en Supabase
      const saved = await saveAudioTranscription(
        currentEntry.id,
        data.audioUrl,
        data.text
      );
      if (!saved) throw new Error('No se pudo guardar la transcripción');
      if (activeEntryId.current !== currentEntry.id) return;
      
      // Actualizar la lista de transcripciones
      fetchTranscriptions();
      
      // Limpiar el estado
      setAudioBlob(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo realizar la transcripción. Inténtalo de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (audioBlob && autoTranscribe.current) {
      autoTranscribe.current = false;
      void processTranscription();
    }
  }, [audioBlob]);

  return (
    <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 space-y-6">
      <h2 className="text-2xl font-semibold text-slate-800 mb-2">
        Grabación de audio
      </h2>
      
      <div className="flex flex-col items-center space-y-6">
        {/* Controles de grabación */}
        <div className="flex flex-wrap justify-center items-center gap-4">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={!currentEntry || isProcessing || Boolean(audioBlob)}
              className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              title="Iniciar grabación"
            >
              <FaMicrophone size={24} />
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="p-4 bg-slate-700 text-white rounded-full hover:bg-slate-800 transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 shadow-md hover:shadow-lg"
              title="Detener grabación"
            >
              <FaStop size={24} />
            </button>
          )}
          
          {/* Reproductor de audio */}
          {audioBlob && !isRecording && (
            <>
              <button
                onClick={isPlaying ? pauseAudio : playAudio}
                className="p-4 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-md hover:shadow-lg"
                title={isPlaying ? "Pausar" : "Reproducir"}
              >
                {isPlaying ? <FaPause size={24} /> : <FaPlay size={24} />}
              </button>
              
              <button
                onClick={processTranscription}
                disabled={isProcessing || !audioBlob}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center min-w-[180px]"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Procesando...
                  </>
                ) : 'Transcribir audio'}
              </button>
            </>
          )}
        </div>
        
        {/* Elemento de audio oculto para reproducción */}
        {audioUrl && (
          <audio
            ref={audioPlayerRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
        )}
        
        {recordingNotice && <p role="status" className="text-sm text-slate-600 text-center">{recordingNotice}</p>}

        {/* Mensaje de error */}
        {error && (
          <div className="w-full max-w-md p-3 bg-red-100 border border-red-300 text-red-700 rounded-md text-sm text-center">
            {error}
          </div>
        )}
        
        {/* Instrucciones */}
        <p className="text-slate-600 text-sm text-center max-w-md">
          {!currentEntry 
            ? "Necesitas crear o seleccionar una entrada para grabar audio."
            : isRecording 
              ? `Grabando ${recordingTime(recordingSeconds)} / 10:00. Se detendrá automáticamente.`
              : audioBlob 
                ? "Puedes reproducir la grabación o transcribir el audio."
                : "Haz clic en el micrófono para comenzar a grabar (máximo 10 minutos)."}
        </p>
      </div>
    </div>
  );
};

export default AudioRecorder;
