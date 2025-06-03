import { create } from 'zustand';
import { DiaryEntry, AudioTranscription, getEntryByDate, saveEntry, getTranscriptionsByEntryId } from './supabase';

interface DiaryState {
  currentDate: string;
  currentEntry: DiaryEntry | null;
  isLoading: boolean;
  isEditing: boolean;
  transcriptions: AudioTranscription[];
  error: string | null;
  dateManuallySelected: boolean; // Flag para rastrear si el usuario seleccionó una fecha manualmente
  
  // Acciones
  setCurrentDate: (date: string, manuallySelected?: boolean) => void;
  fetchCurrentEntry: (userId: string) => Promise<void>;
  saveCurrentEntry: (content: string, userId: string, mentionedPeople?: string[]) => Promise<void>;
  toggleEditMode: () => void;
  fetchTranscriptions: () => Promise<void>;
  resetError: () => void;
}

// Helper para formatear la fecha en YYYY-MM-DD respetando la zona horaria local (España)
const formatDate = (date: Date): string => {
  // Usamos métodos que respetan la zona horaria local
  const year = date.getFullYear();
  // El mes en JavaScript es 0-indexed, necesitamos sumar 1 y asegurar formato de dos dígitos
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// Obtener la fecha actual formateada en zona horaria local
const getTodayFormatted = (): string => {
  return formatDate(new Date());
};

export const useDiaryStore = create<DiaryState>((set, get) => {
  const initialDate = getTodayFormatted();
  console.log('🏪 Store: Inicializando con fecha:', initialDate);
  
  return {
    // Estado inicial - siempre usamos la fecha actual
    currentDate: initialDate,
    currentEntry: null,
    isLoading: false,
    isEditing: false,
    transcriptions: [],
    error: null,
    dateManuallySelected: false, // Inicialmente no se ha seleccionado manualmente
    
    // Acciones
    setCurrentDate: (date: string, manuallySelected = false) => {
      const currentState = get();
      // Solo loguear si la fecha realmente cambió
      if (currentState.currentDate !== date) {
        console.log('🏪 Store: setCurrentDate llamado con:', date, 'manual:', manuallySelected);
      }
      set({ currentDate: date, dateManuallySelected: manuallySelected });
    },
  
  fetchCurrentEntry: async (userId: string) => {
    const { currentDate } = get();
    set({ isLoading: true, error: null });
    
    try {
      const entry = await getEntryByDate(currentDate, userId);
      set({ 
        currentEntry: entry,
        isEditing: !entry, // Si no hay entrada, activamos modo edición
      });
      
      // Si hay una entrada, cargamos las transcripciones
      if (entry) {
        try {
          const transcriptions = await getTranscriptionsByEntryId(entry.id);
          set({ transcriptions });
        } catch (error) {
          console.error('Error fetching transcriptions:', error);
          set({ transcriptions: [] });
        }
      } else {
        set({ transcriptions: [] });
      }
    } catch (error) {
      console.error('Error fetching entry:', error);
      set({ error: 'No se pudo cargar la entrada del diario' });
    } finally {
      set({ isLoading: false });
    }
  },
  
  saveCurrentEntry: async (content: string, userId: string, mentionedPeople?: string[]) => {
    const { currentDate, currentEntry } = get();
    set({ isLoading: true, error: null });
    
    console.log('⭐ Store: Guardando entrada para fecha:', currentDate);
    console.log('⭐ Store: Contenido:', content);
    console.log('⭐ Store: Usuario:', userId);
    console.log('⭐ Store: Entrada actual:', currentEntry);
    console.log('⭐ Store: Personas mencionadas:', mentionedPeople);
    
    try {
      // Preparamos los datos para guardar
      const entryData: Partial<DiaryEntry> = {
        date: currentDate,
        content,
        user_id: userId,
        mentioned_people: mentionedPeople
      };
      
      // Si hay una entrada existente, incluimos su ID
      if (currentEntry?.id) {
        entryData.id = currentEntry.id;
      };
      
      
      console.log('⭐ Store: Datos a guardar:', entryData);
      
      // Guardamos la entrada
      const updatedEntry = await saveEntry(entryData);
      
      if (updatedEntry) {
        console.log('✅ Store: Entrada guardada correctamente:', updatedEntry);
        set({ 
          currentEntry: updatedEntry,
          isEditing: false
        });
      } else {
        console.error('❌ Store: No se pudo guardar la entrada');
        set({ error: 'No se pudo guardar la entrada del diario' });
      }
    } catch (error) {
      console.error('❌ Store: Error saving entry:', error);
      set({ error: 'No se pudo guardar la entrada del diario' });
    } finally {
      set({ isLoading: false });
    }
  },
  
  toggleEditMode: () => {
    set((state) => ({ isEditing: !state.isEditing }));
  },
  
  fetchTranscriptions: async () => {
    const { currentEntry } = get();
    
    if (!currentEntry) return;
    
    try {
      const transcriptions = await getTranscriptionsByEntryId(currentEntry.id);
      set({ transcriptions });
    } catch (error) {
      console.error('Error fetching transcriptions:', error);
      set({ error: 'No se pudieron cargar las transcripciones' });
    }
  },
  
  resetError: () => set({ error: null })
  };
});
