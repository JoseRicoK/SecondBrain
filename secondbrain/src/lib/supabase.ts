import { createClient } from '@supabase/supabase-js';
import { v5 as uuidv5 } from 'uuid';

// Namespace para generar UUIDs determinísticos (debe ser el mismo que en route.ts)
const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

// Función para generar un UUID determinístico a partir de un string
function generateUUID(input: string): string {
  return uuidv5(input, NAMESPACE);
}

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
  mentioned_people?: string[]; // IDs de las personas mencionadas en la entrada
}

export interface AudioTranscription {
  id: string;
  entry_id: string;
  audio_url: string;
  transcription: string;
  created_at: string;
}

// Tipo para la tabla de personas
export interface Person {
  id: string;
  user_id: string; // Este valor debe ser un UUID válido
  name: string;
  details: {
    // El campo details es flexible y puede contener cualquier información
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

// Función auxiliar para validar si un string tiene formato UUID
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
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
        mentioned_people: entry.mentioned_people
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
      mentioned_people: entry.mentioned_people || []
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
  // Convertir a un formato de fecha ISO
  const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString().split('T')[0];
  
  // El último día del mes
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];
  
  console.log(`⭐ Buscando entradas desde ${startDate} hasta ${endDate}`);
  
  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });
  
  if (error) {
    console.error('❌ Error al obtener entradas del mes:', error);
    return [];
  }
  
  return data || [];
}

// FUNCIONES PARA MANEJAR PERSONAS

// Obtener todas las personas de un usuario
export async function getPeopleByUserId(userId: string): Promise<Person[]> {
  console.log('⭐ Obteniendo personas para el usuario original:', userId);
  
  // Convertir el userId a UUID válido si no lo es ya
  const validUUID = isValidUUID(userId) ? userId : generateUUID(userId);
  console.log('UUID válido usado para consulta:', validUUID);
  
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .eq('user_id', validUUID)
    .order('name');
  
  if (error) {
    console.error('❌ Error al obtener personas:', error);
    return [];
  }
  
  return data || [];
}

// Obtener una persona por su ID
export async function getPersonById(personId: string): Promise<Person | null> {
  console.log('⭐ Obteniendo persona con ID:', personId);
  
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .eq('id', personId)
    .maybeSingle();
  
  if (error) {
    console.error('❌ Error al obtener persona:', error);
    return null;
  }
  
  return data;
}

// Obtener una persona por su nombre (para verificar si ya existe)
export async function getPersonByName(name: string, userId: string): Promise<Person | null> {
  console.log('⭐ Buscando persona con nombre:', name);
  
  // Convertir el userId a UUID válido si no lo es ya
  const validUUID = isValidUUID(userId) ? userId : generateUUID(userId);
  
  // Realizamos una búsqueda case-insensitive
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .eq('user_id', validUUID)
    .ilike('name', name)
    .maybeSingle();
  
  if (error) {
    console.error('❌ Error al buscar persona por nombre:', error);
    return null;
  }
  
  return data;
}

// Crear o actualizar una persona
export async function savePerson(person: Partial<Person>): Promise<Person | null> {
  const isNewPerson = !person.id;
  console.log(isNewPerson ? '⭐ Creando nueva persona' : '⭐ Actualizando persona existente');
  
  // Asegurarse de que updated_at esté actualizado
  const updatedPerson = {
    ...person,
    updated_at: new Date().toISOString()
  };
  
  const { data, error } = isNewPerson
    ? await supabase
        .from('people')
        .insert([updatedPerson])
        .select()
        .maybeSingle()
    : await supabase
        .from('people')
        .update(updatedPerson)
        .eq('id', person.id)
        .select()
        .maybeSingle();
  
  if (error) {
    console.error('❌ Error al guardar persona:', error);
    return null;
  }
  
  return data;
}

// Actualizar detalles específicos de una persona
export async function updatePersonDetails(personId: string, details: Record<string, any>): Promise<Person | null> {
  console.log('⭐ Actualizando detalles de persona:', personId);
  
  // Primero obtenemos la persona actual para no sobrescribir todo el objeto details
  const currentPerson = await getPersonById(personId);
  if (!currentPerson) return null;
  
  // Mezclamos los detalles existentes con los nuevos
  const updatedDetails = {
    ...currentPerson.details,
    ...details
  };
  
  // Actualizamos la persona
  return savePerson({
    id: personId,
    details: updatedDetails,
  });
}
