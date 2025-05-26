import React, { useState, useEffect } from 'react';
import Calendar, { OnArgs, Value } from 'react-calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDiaryStore } from '@/lib/store';
import { getEntriesByMonth } from '@/lib/supabase';
import 'react-calendar/dist/Calendar.css';

interface SidebarProps {
  userId: string;
}

const Sidebar: React.FC<SidebarProps> = ({ userId }) => {
  const { currentDate, setCurrentDate, fetchCurrentEntry } = useDiaryStore();
  const [date, setDate] = useState<Date>(new Date());
  const [entriesDates, setEntriesDates] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<Date>(new Date());
  
  // Cargar las entradas para el mes actual
  useEffect(() => {
    const loadEntriesForMonth = async () => {
      const year = currentView.getFullYear();
      const month = currentView.getMonth() + 1;
      const entries = await getEntriesByMonth(year, month, userId);
      
      // Extraer las fechas de las entradas
      const dates = entries.map(entry => entry.date);
      setEntriesDates(dates);
    };
    
    loadEntriesForMonth();
  }, [currentView, userId]);
  
  // Cuando cambia la fecha seleccionada
  const handleDateChange = (newDate: Value, event: React.MouseEvent<HTMLButtonElement>) => {
    if (newDate instanceof Date) {
      setDate(newDate);
      const formattedDate = format(newDate, 'yyyy-MM-dd');
      setCurrentDate(formattedDate);
      fetchCurrentEntry(userId);
    }
  };
  
  // Cuando cambia la vista del calendario (mes/año)
  const handleViewChange = ({ activeStartDate, view }: OnArgs) => {
    if (activeStartDate instanceof Date) {
      setCurrentView(activeStartDate);
    }
  };
  
  // Personalizar el estilo de los días que tienen entradas
  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const formattedDate = format(date, 'yyyy-MM-dd');
      return entriesDates.includes(formattedDate) ? 'has-entry' : null;
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 space-y-4">
      <h2 className="text-xl font-semibold text-center text-gray-800 mb-4">
        Mi Diario
      </h2>
      
      <div className="calendar-container">
        <Calendar
          onChange={handleDateChange}
          value={date}
          onActiveStartDateChange={handleViewChange}
          tileClassName={tileClassName}
          locale="es"
        />
      </div>
      
      <div className="mt-4">
        <p className="text-center text-gray-600">
          {format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
        </p>
      </div>
      
      <style jsx global>{`
        .has-entry {
          background-color: #e3f2fd;
          color: #1976d2;
          font-weight: bold;
        }
        
        .react-calendar {
          width: 100%;
          border: none;
          font-family: inherit;
        }
        
        .react-calendar__tile--active {
          background: #2563eb;
          color: white;
        }
        
        .react-calendar__tile--now {
          background: #dbeafe;
        }
      `}</style>
    </div>
  );
};

export default Sidebar;
