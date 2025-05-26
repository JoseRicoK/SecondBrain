'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import DiaryEditor from '@/components/DiaryEditor';
import AudioRecorder from '@/components/AudioRecorder';
import TranscriptionsList from '@/components/TranscriptionsList';
import { useDiaryStore } from '@/lib/store';

export default function Home() {
  const { fetchCurrentEntry } = useDiaryStore();
  const [isClient, setIsClient] = useState(false);
  
  // Identificador de usuario temporal (en una aplicación real, esto vendría de la autenticación)
  const tempUserId = 'user-1';
  
  // Este efecto se ejecuta solo en el cliente
  useEffect(() => {
    setIsClient(true);
    // Cargar la entrada del día actual
    fetchCurrentEntry(tempUserId);
  }, [fetchCurrentEntry]);

  // No renderizar nada durante la hidratación para evitar errores
  if (!isClient) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">🧠 Second Brain</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Barra lateral (calendario) */}
          <div className="lg:col-span-1">
            <Sidebar userId={tempUserId} />
          </div>
          
          {/* Contenido principal */}
          <div className="lg:col-span-3 space-y-6">
            {/* Editor del diario */}
            <DiaryEditor userId={tempUserId} />
            
            {/* Grabador de audio */}
            <AudioRecorder userId={tempUserId} />
            
            {/* Lista de transcripciones */}
            <TranscriptionsList />
          </div>
        </div>
      </div>
    </div>
  );
}
