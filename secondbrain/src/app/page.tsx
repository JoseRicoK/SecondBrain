'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import IntegratedDiary from '@/components/IntegratedDiary';
import PersonalChat from '@/components/PersonalChat';
import PersonalChatButton from '@/components/PersonalChatButton';
import Auth from '@/components/Auth';
import Loading from '@/components/Loading';
import { useAuth } from '@/hooks/useAuth';
import { useDiaryStore } from '@/lib/store';
import { FiMenu } from 'react-icons/fi';
import Image from 'next/image';
import { User } from '@supabase/supabase-js';

export default function Home() {
  const { user, loading } = useAuth();
  const { fetchCurrentEntry, currentDate } = useDiaryStore();
  const [isClient, setIsClient] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);

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
    console.log('Usuario autenticado:', authenticatedUser);
    // El hook useAuth se encargará de actualizar el estado
  };
  
  // Obtener los datos de la entrada actual cuando cambia la fecha o el usuario
  useEffect(() => {
    if (isClient && user?.id) {
      fetchCurrentEntry(user.id);
    }
  }, [fetchCurrentEntry, isClient, currentDate, user?.id]);

  // Evitar errores de hidratación
  useEffect(() => {
    setIsClient(true);
  }, []);

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

  return (
    <main className="flex min-h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar con overlay cuando está abierto en móvil */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-20 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - diseño flotante en móvil */}
      <aside 
        className={`
          fixed md:relative z-30 h-screen bg-white transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} 
          md:translate-x-0 md:shadow-lg md:w-[400px] w-[90%] max-w-sm
        `}
      >
        {/* El botón X se moverá al componente Sidebar para superponerse */}
        <div className="overflow-y-auto h-full">
          <Sidebar 
            userId={user.id} 
            onClose={() => setIsSidebarOpen(false)} 
            onSettingsClick={() => setShowSettings(true)}
            onDateChange={() => setShowSettings(false)}
          />
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
          <div className="ml-4">
            <Image src="/image/Logo-entero-SecondBrain.png" alt="SecondBrain Logo" width={120} height={24} priority />
          </div>
        </header>
        
        {/* Área principal */}
        <div className="flex-1 overflow-y-auto p-0 md:p-6">
          <IntegratedDiary 
            userId={user.id} 
            showSettings={showSettings}
            onSettingsClose={() => setShowSettings(false)}
          />
        </div>
      </div>

      {/* Chat Personal Flotante */}
      <>
        {/* Botón del Chat Personal */}
        {!isChatOpen && (
          <PersonalChatButton 
            onClick={handleChatToggle}
            isActive={false}
          />
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
