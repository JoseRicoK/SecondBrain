import { createClient } from '@supabase/supabase-js';

// Estas variables deberían estar en tu archivo .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Verificar si las variables de entorno están definidas
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Las variables de entorno para Supabase no están configuradas.\n' +
    'Por favor, crea un archivo .env.local en la raíz del proyecto con:\n' +
    'NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase\n' +
    'NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anon_key'
  );
}

// Crear el cliente de Supabase
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any; // Usamos 'as any' para evitar errores de tipo en desarrollo

// Tipos para nuestras tablas en Supabase
export interface DiaryEntry {
  id: string;
  date: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface AudioTranscription {
  id: string;
  entry_id: string;
  audio_url: string;
  transcription: string;
  created_at: string;
}

// Funciones para interactuar con la base de datos
export async function getEntryByDate(date: string, userId: string): Promise<DiaryEntry | null> {
  console.log('⭐ Buscando entrada para fecha:', date, 'y usuario:', userId);
  
  // Cambiamos .single() por .maybeSingle() para manejar el caso de no encontrar resultados
  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('date', date)
    .eq('user_id', userId)
    .maybeSingle();
  
  if (error) {
    console.error('❌ Error fetching entry:', error);
    return null;
  }
  
  if (data) {
    console.log('✅ Entrada encontrada:', data);
  } else {
    console.log('ℹ️ No se encontró entrada para esta fecha');
  }
  
  return data;
}

export async function saveEntry(entry: Partial<DiaryEntry>): Promise<DiaryEntry | null> {
  console.log('⭐ Intentando guardar entrada:', entry);
  console.log('⭐ URL de Supabase:', supabaseUrl);
  console.log('⭐ Cliente de Supabase inicializado:', !!supabase);

  // Si ya existe un ID, actualizamos
  if (entry.id) {
    console.log('⭐ Actualizando entrada existente, ID:', entry.id);
    const { data, error } = await supabase
      .from('diary_entries')
      .update({
        content: entry.content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entry.id)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error updating entry:', error);
      return null;
    }
    
    console.log('✅ Entrada actualizada correctamente:', data);
    return data;
  } 
  // Si no existe ID, creamos uno nuevo
  else {
    console.log('⭐ Creando nueva entrada para fecha:', entry.date);
    const newEntry = {
      date: entry.date,
      content: entry.content || '',
      user_id: entry.user_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    console.log('⭐ Datos a insertar:', newEntry);

    const { data, error } = await supabase
      .from('diary_entries')
      .insert(newEntry)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error creating entry:', error);
      return null;
    }
    
    console.log('✅ Nueva entrada creada correctamente:', data);
    return data;
  }
}

export async function saveAudioTranscription(
  entryId: string, 
  audioUrl: string, 
  transcription: string
): Promise<AudioTranscription | null> {
  const { data, error } = await supabase
    .from('audio_transcriptions')
    .insert({
      entry_id: entryId,
      audio_url: audioUrl,
      transcription: transcription,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error saving transcription:', error);
    return null;
  }
  
  return data;
}

export async function getTranscriptionsByEntryId(entryId: string): Promise<AudioTranscription[]> {
  const { data, error } = await supabase
    .from('audio_transcriptions')
    .select('*')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching transcriptions:', error);
    return [];
  }
  
  return data || [];
}

export async function getEntriesByMonth(year: number, month: number, userId: string): Promise<DiaryEntry[]> {
  // Crear fechas para el primer y último día del mes
  const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });
  
  if (error) {
    console.error('Error fetching entries for month:', error);
    return [];
  }
  
  return data || [];
}
