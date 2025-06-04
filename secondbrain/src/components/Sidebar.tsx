import React, { useState, useEffect } from 'react';
import Calendar, { OnArgs } from 'react-calendar';
import type { CalendarProps } from 'react-calendar';
import { format } from 'date-fns';
import { FiX, FiSettings, FiCalendar, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
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
  
  const { currentDate, setCurrentDate, dateManuallySelected } = useDiaryStore();
  const [date, setDate] = useState<Date>(today); // Siempre inicializamos con la fecha actual
  const [entriesDates, setEntriesDates] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<Date>(today);
  
  // Al cargar el componente, solo establecer la fecha actual si no se ha seleccionado manualmente
  useEffect(() => {
    // Solo establecer la fecha actual si no se ha seleccionado una fecha manualmente
    if (!dateManuallySelected) {
      // Solo loguear si realmente estamos cambiando la fecha
      if (currentDate !== todayString) {
        console.log('🔄 Sidebar: Estableciendo fecha de hoy (no seleccionada manualmente):', todayString);
      }
      setCurrentDate(todayString, false); // false porque es automático
    }
    // NO llamamos fetchCurrentEntry aquí; esto se maneja en page.tsx
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
      // NO llamamos fetchCurrentEntry aquí; page.tsx lo maneja automáticamente
      
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
    <div className="relative flex flex-col h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
      {/* Patrón de fondo decorativo */}
      <div className="absolute inset-0 opacity-5 sidebar-pattern"></div>
      
      {/* Efecto de brillo sutil */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
      
      {/* Botón de cierre para móviles */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-all duration-200 md:hidden group"
          title="Cerrar menú"
          aria-label="Cerrar menú"
        >
          <FiX size={18} className="text-white group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Header con logo y título */}
      <div className="relative z-10 px-6 pt-6 pb-4">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">🧠</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">SecondBrain</h1>
            <p className="text-sm text-slate-300">Tu diario inteligente</p>
          </div>
        </div>
      </div>

      {/* Separador elegante */}
      <div className="relative z-10 mx-6 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-6"></div>

      {/* Calendario moderno */}
      <div className="relative z-10 flex-1 px-6 overflow-y-auto">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white mb-2 flex items-center">
            <FiCalendar className="mr-2 text-blue-400" />
            Calendario
          </h2>
          <p className="text-sm text-slate-300">Navega por tus entradas</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10 shadow-xl">
          <Calendar
            onChange={handleDateChange}
            value={date}
            onActiveStartDateChange={handleViewChange}
            tileClassName={tileClassName}
            locale="es-ES"
            className="modern-calendar"
            prev2Label={null}
            next2Label={null}
            prevLabel={<FiChevronLeft className="text-slate-400 hover:text-white transition-colors" />}
            nextLabel={<FiChevronRight className="text-slate-400 hover:text-white transition-colors" />}
            calendarType="gregory"
            showWeekNumbers={false}
            formatShortWeekday={(locale, date) => {
              const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
              return weekdays[date.getDay()];
            }}
          />
        </div>
        
        {/* Fecha seleccionada */}
        <div className="mt-4 text-center">
          <p className="text-sm text-slate-300">
            {date ? format(date, "EEEE, d 'de' MMMM", { locale: es }) : 'Ninguna fecha seleccionada'}
          </p>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="relative z-10 p-6 space-y-3">
        <button
          onClick={onSettingsClick}
          className="w-full bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white rounded-xl py-3 px-4 transition-all duration-200 flex items-center justify-center space-x-2 border border-white/10 hover:border-white/20 group"
        >
          <FiSettings className="group-hover:rotate-45 transition-transform duration-300" />
          <span className="font-medium">Configuración</span>
        </button>
        
        <div className="flex items-center justify-center space-x-2 text-xs text-slate-400">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span>Sincronizado</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
