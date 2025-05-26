import React, { useState, useRef } from 'react';
import { useDiaryStore } from '@/lib/store';
import { FaMicrophone, FaStop, FaPlay, FaPause } from 'react-icons/fa';
import { saveAudioTranscription } from '@/lib/supabase';

interface AudioRecorderProps {
  userId: string;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ userId }) => {
  const { currentEntry, fetchTranscriptions } = useDiaryStore();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  
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
              disabled={!currentEntry || isProcessing}
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
        {audioBlob && (
          <audio
            ref={audioPlayerRef}
            src={URL.createObjectURL(audioBlob)}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
        )}
        
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
              ? "Grabando... Haz clic en detener cuando termines."
              : audioBlob 
                ? "Puedes reproducir la grabación o transcribir el audio."
                : "Haz clic en el micrófono para comenzar a grabar (máximo 30 segundos)."}
        </p>
      </div>
    </div>
  );
};

export default AudioRecorder;
