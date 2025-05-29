'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import IntegratedDiary from '@/components/IntegratedDiary';
import { useDiaryStore } from '@/lib/store';
import { FiMenu, FiX } from 'react-icons/fi';

export default function Home() {
  const { fetchCurrentEntry, currentDate } = useDiaryStore();
  const [isClient, setIsClient] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Identificador de usuario temporal
  const tempUserId = 'user-1';
  
  // Obtener los datos de la entrada actual cuando cambia la fecha
  useEffect(() => {
    if (isClient) {
      fetchCurrentEntry(tempUserId);
    }
  }, [fetchCurrentEntry, isClient, currentDate]);

  // Evitar errores de hidratación
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-500 text-lg">Cargando aplicación...</p>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar con overlay cuando está abierto en móvil */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - diseño flotante en móvil */}
      <aside 
        className={`
          fixed md:relative z-30 h-screen bg-white transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} 
          md:translate-x-0 md:shadow-lg md:w-80 w-[85%] max-w-xs
        `}
      >
        <div className="pt-0 px-4 pb-4 flex items-center justify-end border-b border-slate-200 md:hidden">
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="text-slate-500 hover:text-slate-700"
            aria-label="Close sidebar"
          >
            <FiX size={20} />
          </button>
        </div>
        
        <div className="overflow-y-auto h-[calc(100vh_-_37px)] md:h-full">
          {isClient && <Sidebar userId={tempUserId} />}
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header minimalista solo en móvil */}
        <header className="md:hidden bg-white p-4 flex items-center border-b border-slate-200 shadow-sm">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-slate-700 hover:text-slate-900"
            aria-label="Open sidebar"
          >
            <FiMenu size={24} />
          </button>
        </header>
        
        {/* Área principal */}
        <div className="flex-1 overflow-y-auto p-0 md:p-6">
          {isClient && <IntegratedDiary userId={tempUserId} />}
        </div>
      </div>
    </main>
  );
}
