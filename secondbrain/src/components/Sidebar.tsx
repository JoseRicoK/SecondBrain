import React, { useState, useEffect } from 'react';
import Calendar, { OnArgs } from 'react-calendar';
import type { CalendarProps } from 'react-calendar';
import { format } from 'date-fns';
import { FiX, FiSettings } from 'react-icons/fi';
import Image from 'next/image';
import { es } from 'date-fns/locale';
import { useDiaryStore } from '@/lib/store';
import { getEntriesByMonth } from '@/lib/supabase';
// Importante: Asegúrate de que los estilos globales del calendario se importen en globals.css o en el layout principal
// import 'react-calendar/dist/Calendar.css'; // Ya no es necesario aquí si se maneja globalmente

// Helper para formatear la fecha en YYYY-MM-DD respetando la zona horaria local (España)
const formatDateToString = (date: Date): string => {
  // Usamos métodos que respetan la zona horaria local
  const year = date.getFullYear();
  // El mes en JavaScript es 0-indexed, necesitamos sumar 1 y asegurar formato de dos dígitos
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// Eliminamos la función getTodayString que no se está utilizando

interface SidebarProps {
  userId: string;
  onClose?: () => void; // Prop para manejar el cierre en móviles
  onSettingsClick?: () => void; // Prop para manejar la navegación a configuración
  onDateChange?: () => void; // Prop para manejar el cambio de fecha (cerrar configuración)
}

const Sidebar: React.FC<SidebarProps> = ({ userId, onClose, onSettingsClick, onDateChange }) => {
  // Obtenemos la fecha actual del sistema cada vez que se carga el componente
  const today = new Date();
  const todayString = formatDateToString(today);
  
  const { currentDate, setCurrentDate, fetchCurrentEntry, dateManuallySelected } = useDiaryStore();
  const [date, setDate] = useState<Date>(today); // Siempre inicializamos con la fecha actual
  const [entriesDates, setEntriesDates] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<Date>(today);
  
  // Al cargar el componente, solo establecer la fecha actual si no se ha seleccionado manualmente
  useEffect(() => {
    // Solo establecer la fecha actual si no se ha seleccionado una fecha manualmente
    if (!dateManuallySelected) {
      console.log('🔄 Sidebar: Estableciendo fecha de hoy (no seleccionada manualmente):', todayString);
      setCurrentDate(todayString, false); // false porque es automático
    } else {
      console.log('✅ Sidebar: Manteniendo fecha seleccionada manualmente:', currentDate);
    }
    // Cargar la entrada para la fecha actual del store
    fetchCurrentEntry(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadEntriesForMonth = async () => {
      const year = currentView.getFullYear();
      const month = currentView.getMonth() + 1;
      try {
        const entries = await getEntriesByMonth(year, month, userId);
        const dates = entries.map(entry => entry.date);
        setEntriesDates(dates);
      } catch (error) {
        console.error("Error al cargar las entradas del mes:", error);
        setEntriesDates([]); // Asegurarse de que entriesDates esté vacío en caso de error
      }
    };
    
    loadEntriesForMonth();
  }, [currentView, userId]);

  useEffect(() => {
    // Sincronizar el estado local 'date' con 'currentDate' del store
    if (currentDate) {
      setDate(new Date(currentDate + 'T00:00:00')); // Asegurar que se interprete como fecha local
      setCurrentView(new Date(currentDate + 'T00:00:00'));
    }
  }, [currentDate]);

  const handleDateChange = (newDate: CalendarProps['value']) => {
    if (newDate instanceof Date) {
      setDate(newDate);
      const formattedDate = format(newDate, 'yyyy-MM-dd');
      console.log('📅 Sidebar: Usuario seleccionó fecha manualmente:', formattedDate);
      setCurrentDate(formattedDate, true); // true porque es selección manual
      fetchCurrentEntry(userId); // Asumiendo que fetchCurrentEntry usa la fecha del store
      
      // Cerrar configuración si está abierta
      if (onDateChange) {
        onDateChange();
      }
    }
  };
  
  const handleViewChange = ({ activeStartDate }: OnArgs) => {
    if (activeStartDate instanceof Date) {
      setCurrentView(activeStartDate);
    }
  };
  
  const tileClassName = ({ date: tileDate, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const formattedTileDate = format(tileDate, 'yyyy-MM-dd');
      if (entriesDates.includes(formattedTileDate)) {
        return 'has-entry';
      }
    }
    return null;
  };

  return (
    <div className="relative flex flex-col h-full bg-gradient-to-br from-purple-200 via-white to-white pt-4">
      {/* Botón de cierre para móviles, superpuesto */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 text-slate-600 hover:text-slate-800 md:hidden z-10"
          aria-label="Cerrar menú"
        >
          <FiX size={24} />
        </button>
      )}
      {/* Logo para la versión de escritorio */}
      <div className="pl-6 mb-8 pt-4 hidden md:block">
        {/* Este logo se mostrará en desktop. El logo de móvil está en page.tsx */}
        {/* Ajusta width y height según el aspect ratio de tu Logo-simple-SecondBrain.png */}
        <Image src="/image/Logo-entero-SecondBrain.png" alt="SecondBrain Logo" width={140} height={28} />
      </div>
      
      {/* Sección del calendario con efecto cristal (glassmorphism) */}
      <div className="bg-white/40 backdrop-blur-sm rounded-[25px] shadow-lg p-6 mx-4 mb-4 border border-white/30">
        <h2 className="text-lg font-semibold text-center text-slate-700 mb-4 flex items-center justify-center">
          <svg className="w-5 h-5 mr-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          Calendario
        </h2>
        
        <div className="calendar-container mx-auto">
          <Calendar
            onChange={handleDateChange}
            value={date}
            onActiveStartDateChange={handleViewChange}
            tileClassName={tileClassName}
            locale="es"
            className="custom-calendar rounded-xl border-0 shadow-none w-full"
            maxDate={new Date(2100, 11, 31)}
            minDate={new Date(2000, 0, 1)}
          />
        </div>
        
        {/* Fecha seleccionada incluida dentro del contenedor del calendario */}
        <div className="text-center mt-4 pt-3 border-t border-slate-100">
          <p className="font-medium text-slate-700">
            {date ? format(date, "EEEE, d 'de' MMMM", { locale: es }) : 'Ninguna fecha seleccionada'}
          </p>
        </div>
      </div>
      
      {/* Botón de configuración */}
      <div className="mx-4 mb-8">
        <button
          onClick={onSettingsClick}
          className="w-full flex items-center justify-center px-4 py-3 bg-white/30 backdrop-blur-sm hover:bg-white/50 text-slate-700 rounded-[15px] border border-white/20 transition-colors shadow-sm"
        >
          <FiSettings className="mr-2" size={18} />
          <span className="font-medium">Configuración</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
