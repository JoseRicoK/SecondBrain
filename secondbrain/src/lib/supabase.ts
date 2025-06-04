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

// Crear el cliente de Supabase con persistencia mejorada
// Usamos una aserción de tipo para el cliente de Supabase,
// ya que el tipo correcto es muy extenso y específico
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'secondbrain-auth-token',
      }
    })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  : null as any; // Necesario para desarrollo

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

// Interfaces para el nuevo formato de detalles con fechas
export interface PersonDetailEntry {
  value: string;
  date: string; // Formato YYYY-MM-DD
}

export interface PersonDetailCategory {
  entries: PersonDetailEntry[];
}

// Tipo para la tabla de personas
export interface Person {
  id: string;
  user_id: string; // Este valor debe ser un UUID válido
  name: string;
  details: {
    // El campo details ahora usa la nueva estructura con fechas
    // Ejemplo: { "rol": { "entries": [{"value": "estudiante", "date": "2024-01-15"}] } }
    [key: string]: PersonDetailCategory | unknown; // unknown para compatibilidad con datos antiguos
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

// Obtener todas las entradas de diario de un usuario (para chat personal)
export async function getDiaryEntriesByUserId(userId: string): Promise<DiaryEntry[]> {
  console.log('⭐ Obteniendo todas las entradas del usuario:', userId);
  
  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  
  if (error) {
    console.error('❌ Error al obtener entradas del usuario:', error);
    return [];
  }
  
  console.log(`✅ Se encontraron ${data?.length || 0} entradas para el usuario`);
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
export async function updatePersonDetails(personId: string, details: Record<string, unknown>): Promise<Person | null> {
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

// NUEVAS FUNCIONES PARA MANEJAR LA ESTRUCTURA CON FECHAS

// Función para convertir detalles antiguos al nuevo formato
export function migrateDetailsToNewFormat(oldDetails: Record<string, unknown>, fallbackDate?: string): Record<string, PersonDetailCategory> {
  const currentDate = fallbackDate || new Date().toISOString().split('T')[0];
  const newDetails: Record<string, PersonDetailCategory> = {};
  
  for (const [key, value] of Object.entries(oldDetails)) {
    // Si ya tiene la nueva estructura, mantenerla
    if (value && typeof value === 'object' && 'entries' in value) {
      newDetails[key] = value as PersonDetailCategory;
    }
    // Si es un array de strings, convertirlo
    else if (Array.isArray(value)) {
      newDetails[key] = {
        entries: value.map(item => ({
          value: String(item),
          date: currentDate
        }))
      };
    }
    // Si es un string simple, convertirlo
    else if (typeof value === 'string') {
      newDetails[key] = {
        entries: [{
          value: value,
          date: currentDate
        }]
      };
    }
    // Para otros tipos, convertir a string
    else {
      newDetails[key] = {
        entries: [{
          value: String(value),
          date: currentDate
        }]
      };
    }
  }
  
  return newDetails;
}

// Función para añadir un nuevo detalle a una categoría específica
export async function addPersonDetail(personId: string, category: string, value: string, date?: string): Promise<Person | null> {
  console.log('⭐ Añadiendo detalle a persona:', personId, 'categoría:', category, 'valor:', value);
  
  const currentPerson = await getPersonById(personId);
  if (!currentPerson) return null;
  
  const detailDate = date || new Date().toISOString().split('T')[0];
  const newDetails = { ...currentPerson.details };
  
  // Convertir detalles antiguos si es necesario
  const migratedDetails = migrateDetailsToNewFormat(newDetails, detailDate);
  
  // Si la categoría no existe, crearla
  if (!migratedDetails[category]) {
    migratedDetails[category] = { entries: [] };
  }
  
  // Añadir el nuevo detalle
  migratedDetails[category].entries.push({
    value,
    date: detailDate
  });
  
  // Guardar los cambios
  return savePerson({
    id: personId,
    details: migratedDetails,
  });
}

// Función para obtener detalles de una persona con formato compatible
export function getPersonDetailsWithDates(person: Person): Record<string, PersonDetailCategory> {
  if (!person.details) return {};
  
  // Si ya tiene el nuevo formato, usarlo directamente
  const hasNewFormat = Object.values(person.details).some(value => 
    value && typeof value === 'object' && 'entries' in value
  );
  
  if (hasNewFormat) {
    return person.details as Record<string, PersonDetailCategory>;
  }
  
  // Si tiene formato antiguo, migrarlo temporalmente para la visualización
  return migrateDetailsToNewFormat(person.details, person.updated_at.split('T')[0]);
}

// Función para guardar información de personas extraída de las entradas del diario
export async function saveExtractedPersonInfo(
  personName: string, 
  information: Record<string, unknown>, 
  userId: string,
  entryDate?: string
): Promise<Person | null> {
  console.log('⭐ Guardando información extraída de persona:', personName);
  console.log('🔍 Información recibida:', JSON.stringify(information, null, 2));
  
  // Convertir userId a UUID válido
  const validUUID = isValidUUID(userId) ? userId : generateUUID(userId);
  const detailDate = entryDate || new Date().toISOString().split('T')[0];
  console.log('📅 Fecha de detalle:', detailDate);
  
  // Buscar si la persona ya existe
  const existingPerson = await getPersonByName(personName, validUUID);
  
  if (existingPerson) {
    console.log('✅ Persona existente encontrada, actualizando información...');
    
    // Obtener detalles actuales con formato compatible
    const currentDetails = getPersonDetailsWithDates(existingPerson);
    
    // Procesar la nueva información
    for (const [category, newValue] of Object.entries(information)) {
      if (!newValue) continue;
      
      // Inicializar categoría si no existe
      if (!currentDetails[category]) {
        currentDetails[category] = { entries: [] };
      }
      
      // Asegurar que la categoría tiene la estructura correcta
      if (!currentDetails[category].entries || !Array.isArray(currentDetails[category].entries)) {
        currentDetails[category] = { entries: [] };
      }
      
      // Determinar si es una categoría que debería tener un solo valor (como rol, relacion)
      const singleValueCategories = ['rol', 'relacion'];
      const isSingleValueCategory = singleValueCategories.includes(category.toLowerCase());
      
      // Función helper para procesar valores
      const processValue = (value: string) => {
        const trimmedValue = value.trim();
        if (!trimmedValue) return;
        
        // No añadir "desconocido" si ya hay información válida en la categoría
        if (trimmedValue.toLowerCase() === 'desconocido' && currentDetails[category].entries.length > 0) {
          console.log(`⏭️ Ignorando "desconocido" para ${category} porque ya hay información válida`);
          return;
        }
        
        if (isSingleValueCategory) {
          // Para categorías de valor único, verificar si es más específico que lo existente
          const existingEntries = currentDetails[category].entries;
          
          // Si el nuevo valor es "desconocido", no reemplazar valores existentes
          if (trimmedValue.toLowerCase() === 'desconocido' && existingEntries.length > 0) {
            console.log(`⏭️ No reemplazando ${category} existente con "desconocido"`);
            return;
          }
          
          // Si ya existe el mismo valor, no hacer nada
          const exists = existingEntries.some(entry => 
            entry.value.toLowerCase() === trimmedValue.toLowerCase()
          );
          
          if (exists) {
            console.log(`⏭️ ${category} ya existe: "${trimmedValue}"`);
            return;
          }
          
          // Reemplazar el valor anterior (mantener solo el más reciente)
          currentDetails[category].entries = [{
            value: trimmedValue,
            date: detailDate
          }];
          console.log(`🔄 Actualizado ${category}: "${trimmedValue}"`);
        } else {
          // Para categorías de múltiples valores (como detalles), añadir sin duplicados
          const exists = currentDetails[category].entries.some(entry => 
            entry.value.toLowerCase() === trimmedValue.toLowerCase()
          );
          
          if (!exists) {
            currentDetails[category].entries.push({
              value: trimmedValue,
              date: detailDate
            });
            console.log(`➕ Añadido nuevo ${category}: "${trimmedValue}"`);
          } else {
            console.log(`⏭️ ${category} ya existe: "${trimmedValue}"`);
          }
        }
      };
      
      // Si es un array, procesar cada elemento
      if (Array.isArray(newValue)) {
        for (const item of newValue) {
          if (item !== null && item !== undefined) {
            processValue(String(item));
          }
        }
      }
      // Si es un string simple
      else if (typeof newValue === 'string') {
        processValue(newValue);
      }
      // Si es otro tipo, convertir a string
      else if (newValue !== null && newValue !== undefined) {
        processValue(String(newValue));
      }
    }
    
    // Actualizar la persona
    console.log('💾 Guardando detalles actualizados:', JSON.stringify(currentDetails, null, 2));
    return savePerson({
      id: existingPerson.id,
      details: currentDetails,
    });
  } else {
    console.log('✅ Creando nueva persona...');
    
    // Crear nueva persona con formato de detalles con fechas
    const newDetails: Record<string, PersonDetailCategory> = {};
    
    // Procesar la información para crear el formato correcto
    for (const [category, newValue] of Object.entries(information)) {
      if (!newValue) continue;
      
      // Inicializar la categoría
      newDetails[category] = { entries: [] };
      
      // Determinar si es una categoría que debería tener un solo valor
      const singleValueCategories = ['rol', 'relacion'];
      const isSingleValueCategory = singleValueCategories.includes(category.toLowerCase());
      
      // Función helper para procesar valores
      const processValue = (value: string) => {
        const trimmedValue = value.trim();
        if (!trimmedValue) return;
        
        // No guardar "desconocido" si ya hay un valor válido en la categoría
        if (trimmedValue.toLowerCase() === 'desconocido' && newDetails[category].entries.length > 0) {
          return;
        }
        
        if (isSingleValueCategory) {
          // Para categorías de valor único, solo mantener el último valor válido (no "desconocido")
          if (trimmedValue.toLowerCase() !== 'desconocido' || newDetails[category].entries.length === 0) {
            newDetails[category].entries = [{
              value: trimmedValue,
              date: detailDate
            }];
          }
        } else {
          // Para categorías de múltiples valores, añadir sin duplicados
          const exists = newDetails[category].entries.some(entry => 
            entry.value.toLowerCase() === trimmedValue.toLowerCase()
          );
          
          if (!exists) {
            newDetails[category].entries.push({
              value: trimmedValue,
              date: detailDate
            });
          }
        }
      };
      
      // Si es un array, procesar cada elemento
      if (Array.isArray(newValue)) {
        for (const item of newValue) {
          if (item && String(item).trim()) {
            processValue(String(item));
          }
        }
      }
      // Si es un string simple
      else if (typeof newValue === 'string' && newValue.trim()) {
        processValue(newValue);
      }
      // Si es otro tipo, convertir a string
      else if (newValue !== null && newValue !== undefined) {
        processValue(String(newValue));
      }
    }
    
    console.log('💾 Creando nueva persona con detalles:', JSON.stringify(newDetails, null, 2));
    
    return savePerson({
      user_id: validUUID,
      name: personName,
      details: newDetails,
      created_at: new Date().toISOString(),
    });
  }
}

// Función para obtener información del usuario autenticado
export async function getUserInfo(): Promise<{ name: string; email: string | null }> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Error getting user:', error);
      return { name: 'Usuario', email: null };
    }

    if (!user) {
      return { name: 'Usuario', email: null };
    }

    // Extract name from raw_user_meta_data (where Supabase stores it)
    const name = user.raw_user_meta_data?.name || 
                 user.user_metadata?.name || 
                 user.email?.split('@')[0] || 
                 'Usuario';

    return {
      name,
      email: user.email || null
    };
  } catch (error) {
    console.error('Error in getUserInfo:', error);
    return { name: 'Usuario', email: null };
  }
}

// Funciones de autenticación
export async function updateUserProfile(updates: { display_name?: string }) {
  if (!supabase) {
    throw new Error('Supabase no está configurado');
  }

  const { data, error } = await supabase.auth.updateUser({
    data: updates
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function updateUserPassword(newPassword: string) {
  if (!supabase) {
    throw new Error('Supabase no está configurado');
  }

  if (newPassword.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres');
  }

  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteUserAccount() {
  if (!supabase) {
    throw new Error('Supabase no está configurado');
  }

  // Obtener el usuario actual
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('No hay usuario autenticado');
  }

  // Eliminar todos los datos del usuario primero
  await deleteAllUserData(user.id);

  // Cerrar sesión
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    throw error;
  }

  return true;
}

async function deleteAllUserData(userId: string) {
  if (!supabase) {
    throw new Error('Supabase no está configurado');
  }

  // Eliminar entradas del diario
  await supabase
    .from('diary_entries')
    .delete()
    .eq('user_id', userId);

  // Eliminar transcripciones de audio
  const { data: entries } = await supabase
    .from('diary_entries')
    .select('id')
    .eq('user_id', userId);
    
  if (entries && entries.length > 0) {
    await supabase
      .from('audio_transcriptions')
      .delete()
      .in('entry_id', entries.map((entry: { id: string }) => entry.id));
  }

  // Eliminar personas
  await supabase
    .from('people')
    .delete()
    .eq('user_id', userId);
}

export async function sendFeedbackEmail(type: 'suggestion' | 'problem', message: string, userEmail: string) {
  try {
    const response = await fetch('/api/send-feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        message,
        userEmail,
        timestamp: new Date().toISOString()
      }),
    });

    if (!response.ok) {
      throw new Error('Error al enviar el mensaje');
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending feedback:', error);
    throw error;
  }
}
