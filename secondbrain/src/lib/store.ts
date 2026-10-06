import { create } from "zustand";
import {
  DiaryEntry,
  AudioTranscription,
  getEntryByDate,
  saveEntry,
  getTranscriptionsByEntryId,
} from "./supabase-operations";

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
  saveCurrentEntry: (
    content: string,
    userId: string,
    mentionedPeople?: string[],
    mentionedPersonIds?: string[] | null,
  ) => Promise<void>;
  toggleEditMode: () => void;
  fetchTranscriptions: () => Promise<void>;
  resetError: () => void;
}

// Helper para formatear la fecha en YYYY-MM-DD respetando la zona horaria local (España)
const formatDate = (date: Date): string => {
  // Usamos métodos que respetan la zona horaria local
  const year = date.getFullYear();
  // El mes en JavaScript es 0-indexed, necesitamos sumar 1 y asegurar formato de dos dígitos
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// Obtener la fecha actual formateada en zona horaria local
const getTodayFormatted = (): string => {
  return formatDate(new Date());
};

export const useDiaryStore = create<DiaryState>((set, get) => {
  // Invalidate pending work when another date, account or request is selected.
  let revision = 0;
  return {
    currentDate: getTodayFormatted(),
    currentEntry: null,
    isLoading: false,
    isEditing: false,
    transcriptions: [],
    error: null,
    dateManuallySelected: false,
    setCurrentDate: (date, manuallySelected = false) => {
      if (get().currentDate !== date) {
        revision++;
        set({
          currentDate: date,
          dateManuallySelected: manuallySelected,
          currentEntry: null,
          transcriptions: [],
          error: null,
          isEditing: true,
          isLoading: false,
        });
      } else set({ dateManuallySelected: manuallySelected });
    },
    fetchCurrentEntry: async (userId) => {
      const currentDate = get().currentDate;
      const request = ++revision;
      const isCurrent = () =>
        revision === request && get().currentDate === currentDate;
      set({
        isLoading: true,
        error: null,
        currentEntry: null,
        transcriptions: [],
      });
      try {
        const entry = await getEntryByDate(currentDate, userId);
        if (!isCurrent()) return;
        set({ currentEntry: entry, isEditing: !entry });
        if (entry) {
          try {
            const transcriptions = await getTranscriptionsByEntryId(entry.id);
            if (isCurrent()) set({ transcriptions });
          } catch {
            if (isCurrent()) set({ transcriptions: [] });
          }
        }
      } catch {
        if (isCurrent())
          set({ error: "No se pudo cargar la entrada del diario" });
      } finally {
        if (isCurrent()) set({ isLoading: false });
      }
    },
    saveCurrentEntry: async (
      content,
      userId,
      mentionedPeople,
      mentionedPersonIds,
    ) => {
      const { currentDate, currentEntry } = get();
      const request = ++revision;
      const isCurrent = () =>
        revision === request && get().currentDate === currentDate;
      set({ isLoading: true, error: null });
      const entryData: Partial<DiaryEntry> = {
        date: currentDate,
        content,
        user_id: userId,
        mentioned_people: mentionedPeople,
        ...(mentionedPersonIds !== undefined
          ? { mentioned_person_ids: mentionedPersonIds }
          : {}),
      };
      if (
        currentEntry?.id &&
        currentEntry.date === currentDate &&
        currentEntry.user_id === userId
      ) {
        entryData.id = currentEntry.id;
      }
      try {
        const updatedEntry = await saveEntry(entryData);
        if (!isCurrent()) return;
        if (updatedEntry) set({ currentEntry: updatedEntry, isEditing: false });
        else set({ error: "No se pudo guardar la entrada del diario" });
      } catch {
        if (isCurrent())
          set({ error: "No se pudo guardar la entrada del diario" });
      } finally {
        if (isCurrent()) set({ isLoading: false });
      }
    },
    toggleEditMode: () => set((state) => ({ isEditing: !state.isEditing })),
    fetchTranscriptions: async () => {
      const entry = get().currentEntry;
      const request = revision;
      if (!entry) return;
      const isCurrent = () =>
        revision === request && get().currentEntry?.id === entry.id;
      try {
        const transcriptions = await getTranscriptionsByEntryId(entry.id);
        if (isCurrent()) set({ transcriptions });
      } catch {
        if (isCurrent())
          set({ error: "No se pudieron cargar las transcripciones" });
      }
    },
    resetError: () => set({ error: null }),
  };
});
