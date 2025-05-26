import React, { useState, useEffect } from 'react';
import Calendar, { OnArgs } from 'react-calendar';
import type { CalendarProps } from 'react-calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDiaryStore } from '@/lib/store';
import { getEntriesByMonth } from '@/lib/supabase';
// Importante: Asegúrate de que los estilos globales del calendario se importen en globals.css o en el layout principal
// import 'react-calendar/dist/Calendar.css'; // Ya no es necesario aquí si se maneja globalmente

interface SidebarProps {
  userId: string;
}

const Sidebar: React.FC<SidebarProps> = ({ userId }) => {
  const { currentDate, setCurrentDate, fetchCurrentEntry } = useDiaryStore();
  const [date, setDate] = useState<Date | null>(currentDate ? new Date(currentDate + 'T00:00:00') : new Date()); // Inicializar con la fecha actual del store o la fecha actual
  const [entriesDates, setEntriesDates] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<Date>(new Date(currentDate || Date.now()));

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
    <div className="bg-white lg:bg-transparent rounded-lg lg:rounded-none shadow-lg lg:shadow-none p-4 lg:p-0 space-y-6">
      <h2 className="text-xl font-semibold text-center text-slate-700 mb-3 hidden lg:block">
        Calendario
      </h2>
      
      <div className="calendar-container mx-auto max-w-xs sm:max-w-sm md:max-w-md lg:max-w-full">
        <Calendar
          onChange={handleDateChange}
          value={date as Date}
          onActiveStartDateChange={handleViewChange}
          tileClassName={tileClassName}
          locale="es"
          className="border-none shadow-none lg:border lg:shadow-sm lg:rounded-lg"
        />
      </div>
      
      <div className="mt-6 text-center">
        <p className="text-sm text-slate-600">
          Entrada para: <span className="font-semibold text-slate-700">
            {date ? format(date, "EEEE, d 'de' MMMM", { locale: es }) : 'Ninguna fecha seleccionada'}
          </span>
        </p>
      </div>
    </div>
  );
};

export default Sidebar;
