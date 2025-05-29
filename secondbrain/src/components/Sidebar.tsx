import React, { useState, useEffect } from 'react';
import Calendar, { OnArgs } from 'react-calendar';
import type { CalendarProps } from 'react-calendar';
import { format } from 'date-fns';
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
}

const Sidebar: React.FC<SidebarProps> = ({ userId }) => {
  // Obtenemos la fecha actual del sistema cada vez que se carga el componente
  const today = new Date();
  const todayString = formatDateToString(today);
  
  const { currentDate, setCurrentDate, fetchCurrentEntry } = useDiaryStore();
  const [date, setDate] = useState<Date>(today); // Siempre inicializamos con la fecha actual
  const [entriesDates, setEntriesDates] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<Date>(today);
  
  // Al cargar el componente, asegurarnos de que se seleccione el día actual
  useEffect(() => {
    // Establecemos la fecha actual en el store
    setCurrentDate(todayString);
    // Cargamos la entrada para hoy
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
      setCurrentDate(formattedDate);
      fetchCurrentEntry(userId); // Asumiendo que fetchCurrentEntry usa la fecha del store
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
    <div className="flex flex-col h-full bg-gradient-to-br from-purple-200 via-white to-white pt-4">
      {/* Título directamente en el componente principal */}
      <div className="flex items-center justify-start pl-4 mb-6">
        <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center mr-2 shadow-sm">
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
          </svg>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800">SecondBrain</h1>
      </div>
      
      {/* Sección del calendario con efecto cristal (glassmorphism) */}
      <div className="bg-white/40 backdrop-blur-sm rounded-[25px] shadow-lg p-5 mb-6 border border-white/30">
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
    </div>
  );
};

export default Sidebar;
