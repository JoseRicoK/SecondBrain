import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword as firebaseSignIn,
  signOut as firebaseSignOut,
  updatePassword,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  deleteUser,
  User as FirebaseUser
} from 'firebase/auth';
import { v5 as uuidv5 } from 'uuid';
import { db, auth } from './firebase';

// Namespace para generar UUIDs determinísticos
const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

// Función para generar un UUID determinístico a partir de un string
function generateUUID(input: string): string {
  return uuidv5(input, NAMESPACE);
}

// Interfaces para Firebase
export interface DiaryEntry {
  id: string;
  date: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  mentioned_people?: string[];
}

// Exportar el tipo de usuario de Firebase para compatibilidad
export type { FirebaseUser };

export interface AudioTranscription {
  id: string;
  entry_id: string;
  audio_url: string;
  transcription: string;
  created_at: string;
}

export interface PersonDetailEntry {
  value: string;
  date: string;
}

export interface PersonDetailCategory {
  entries: PersonDetailEntry[];
}

export interface Person {
  id: string;
  user_id: string;
  name: string;
  details: {
    [key: string]: PersonDetailCategory | unknown;
  };
  created_at: string;
  updated_at: string;
}

// Función auxiliar para validar si un string tiene formato UUID
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Función auxiliar para convertir Timestamp de Firebase a string ISO
function timestampToISOString(timestamp: unknown): string {
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
    return (timestamp as { toDate: () => Date }).toDate().toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  if (typeof timestamp === 'string') {
    return timestamp;
  }
  return new Date().toISOString();
}

// =====================================
// FUNCIONES DE DIARIO
// =====================================

export async function getEntryByDate(date: string, userId: string): Promise<DiaryEntry | null> {
  console.log('⭐ [Firebase] Buscando entrada para fecha:', date, 'y usuario:', userId);
  
  try {
    const entriesRef = collection(db, 'diary_entries');
    const q = query(
      entriesRef,
      where('date', '==', date),
      where('user_id', '==', userId),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('⭐ [Firebase] No se encontró entrada para la fecha:', date);
      return null;
    }
    
    const docData = querySnapshot.docs[0].data();
    const entry: DiaryEntry = {
      id: querySnapshot.docs[0].id,
      date: docData.date,
      content: docData.content,
      created_at: timestampToISOString(docData.created_at),
      updated_at: timestampToISOString(docData.updated_at),
      user_id: docData.user_id,
      mentioned_people: docData.mentioned_people || []
    };
    
    console.log('✅ [Firebase] Entrada encontrada:', entry);
    return entry;
  } catch (error) {
    console.error('❌ [Firebase] Error al obtener entrada:', error);
    return null;
  }
}

export async function saveEntry(entry: Partial<DiaryEntry>): Promise<DiaryEntry | null> {
  console.log('⭐ [Firebase] Intentando guardar entrada:', entry);
  
  try {
    const entriesRef = collection(db, 'diary_entries');
    
    if (entry.id) {
      // Actualizar entrada existente
      console.log('⭐ [Firebase] Actualizando entrada existente, ID:', entry.id);
      const docRef = doc(entriesRef, entry.id);
      
      const updateData = {
        content: entry.content,
        updated_at: serverTimestamp(),
        mentioned_people: entry.mentioned_people || []
      };
      
      await updateDoc(docRef, updateData);
      
      // Obtener el documento actualizado
      const updatedDoc = await getDoc(docRef);
      if (updatedDoc.exists()) {
        const data = updatedDoc.data();
        const updatedEntry: DiaryEntry = {
          id: updatedDoc.id,
          date: data.date,
          content: data.content,
          created_at: timestampToISOString(data.created_at),
          updated_at: timestampToISOString(data.updated_at),
          user_id: data.user_id,
          mentioned_people: data.mentioned_people || []
        };
        
        console.log('✅ [Firebase] Entrada actualizada correctamente:', updatedEntry);
        return updatedEntry;
      }
    } else {
      // Crear nueva entrada
      console.log('⭐ [Firebase] Creando nueva entrada para fecha:', entry.date);
      const newDocRef = doc(entriesRef);
      
      const newEntry = {
        date: entry.date,
        content: entry.content || '',
        user_id: entry.user_id,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        mentioned_people: entry.mentioned_people || []
      };
      
      await setDoc(newDocRef, newEntry);
      
      // Obtener el documento creado
      const createdDoc = await getDoc(newDocRef);
      if (createdDoc.exists()) {
        const data = createdDoc.data();
        const createdEntry: DiaryEntry = {
          id: createdDoc.id,
          date: data.date,
          content: data.content,
          created_at: timestampToISOString(data.created_at),
          updated_at: timestampToISOString(data.updated_at),
          user_id: data.user_id,
          mentioned_people: data.mentioned_people || []
        };
        
        console.log('✅ [Firebase] Nueva entrada creada correctamente:', createdEntry);
        return createdEntry;
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ [Firebase] Error al guardar entrada:', error);
    return null;
  }
}

export async function getDiaryEntriesByUserId(userId: string): Promise<DiaryEntry[]> {
  console.log('⭐ [Firebase] Obteniendo todas las entradas del usuario:', userId);
  
  try {
    const entriesRef = collection(db, 'diary_entries');
    const q = query(
      entriesRef,
      where('user_id', '==', userId),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    const entries: DiaryEntry[] = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        date: data.date,
        content: data.content,
        created_at: timestampToISOString(data.created_at),
        updated_at: timestampToISOString(data.updated_at),
        user_id: data.user_id,
        mentioned_people: data.mentioned_people || []
      };
    });
    
    console.log(`✅ [Firebase] Se encontraron ${entries.length} entradas para el usuario`);
    return entries;
  } catch (error) {
    console.error('❌ [Firebase] Error al obtener entradas del usuario:', error);
    return [];
  }
}

export async function getEntriesByMonth(year: number, month: number, userId: string): Promise<DiaryEntry[]> {
  console.log(`⭐ [Firebase] Buscando entradas desde ${year}-${month} para usuario: ${userId}`);
  
  try {
    // Calcular el rango de fechas para el mes
    const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString().split('T')[0];
    const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];
    
    console.log(`⭐ [Firebase] Rango de fechas: ${startDate} a ${endDate}`);
    
    const entriesRef = collection(db, 'diary_entries');
    const q = query(
      entriesRef,
      where('user_id', '==', userId),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    const entries: DiaryEntry[] = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        date: data.date,
        content: data.content,
        created_at: timestampToISOString(data.created_at),
        updated_at: timestampToISOString(data.updated_at),
        user_id: data.user_id,
        mentioned_people: data.mentioned_people || []
      };
    });
    
    console.log(`✅ [Firebase] Se encontraron ${entries.length} entradas para el mes`);
    return entries;
  } catch (error) {
    console.error('❌ [Firebase] Error al obtener entradas del mes:', error);
    return [];
  }
}

// =====================================
// FUNCIONES DE PERSONAS
// =====================================

export async function getPeopleByUserId(userId: string): Promise<Person[]> {
  console.log('⭐ [Firebase] Obteniendo personas para el usuario:', userId);
  
  try {
    // Convertir el userId a UUID válido si no lo es ya
    const validUUID = isValidUUID(userId) ? userId : generateUUID(userId);
    console.log('UUID válido usado para consulta:', validUUID);
    
    const peopleRef = collection(db, 'people');
    const q = query(
      peopleRef,
      where('user_id', '==', validUUID),
      orderBy('name')
    );
    
    const querySnapshot = await getDocs(q);
    
    const people: Person[] = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        user_id: data.user_id,
        name: data.name,
        details: data.details || {},
        created_at: timestampToISOString(data.created_at),
        updated_at: timestampToISOString(data.updated_at)
      };
    });
    
    console.log(`✅ [Firebase] Se encontraron ${people.length} personas`);
    return people;
  } catch (error) {
    console.error('❌ [Firebase] Error al obtener personas:', error);
    return [];
  }
}

export async function savePerson(person: Partial<Person>): Promise<Person | null> {
  const isNewPerson = !person.id;
  console.log(isNewPerson ? '⭐ [Firebase] Creando nueva persona' : '⭐ [Firebase] Actualizando persona existente');
  
  try {
    const peopleRef = collection(db, 'people');
    
    if (isNewPerson) {
      // Crear nueva persona
      const newDocRef = doc(peopleRef);
      const newPerson = {
        ...person,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };
      
      await setDoc(newDocRef, newPerson);
      
      const createdDoc = await getDoc(newDocRef);
      if (createdDoc.exists()) {
        const data = createdDoc.data();
        return {
          id: createdDoc.id,
          user_id: data.user_id,
          name: data.name,
          details: data.details || {},
          created_at: timestampToISOString(data.created_at),
          updated_at: timestampToISOString(data.updated_at)
        };
      }
    } else {
      // Actualizar persona existente
      const docRef = doc(peopleRef, person.id);
      const updateData = {
        ...person,
        updated_at: serverTimestamp()
      };
      delete updateData.id; // No incluir el ID en el update
      
      await updateDoc(docRef, updateData);
      
      const updatedDoc = await getDoc(docRef);
      if (updatedDoc.exists()) {
        const data = updatedDoc.data();
        return {
          id: updatedDoc.id,
          user_id: data.user_id,
          name: data.name,
          details: data.details || {},
          created_at: timestampToISOString(data.created_at),
          updated_at: timestampToISOString(data.updated_at)
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ [Firebase] Error al guardar persona:', error);
    return null;
  }
}

// =====================================
// FUNCIONES DE AUTENTICACIÓN
// =====================================

export async function signUpUser(email: string, password: string, displayName: string): Promise<FirebaseUser | null> {
  try {
    console.log('🔍 [Firebase] Iniciando registro para:', email);
    
    // Verificar configuración básica
    if (!auth) {
      throw new Error('Firebase Auth no está inicializado');
    }
    
    console.log('🔧 [Firebase] Configuración verificada, creando usuario...');
    console.log('🔧 [Firebase] Auth Domain:', auth.config.authDomain);
    console.log('🔧 [Firebase] Project ID:', auth.config.apiKey ? 'Configurado' : 'No configurado');
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    console.log('✅ [Firebase] Usuario creado, actualizando perfil...');
    
    // Actualizar el perfil del usuario con el nombre
    await updateProfile(userCredential.user, {
      displayName: displayName
    });
    
    console.log('📧 [Firebase] Enviando email de verificación...');
    
    // Enviar email de verificación
    await sendEmailVerification(userCredential.user);
    
    console.log('✅ [Firebase] Usuario registrado correctamente:', userCredential.user.uid);
    console.log('📧 [Firebase] Email de verificación enviado correctamente');
    
    // Cerrar sesión para que el usuario no pueda acceder sin verificar
    await firebaseSignOut(auth);
    
    console.log('🔐 [Firebase] Sesión cerrada - usuario debe verificar email antes de acceder');
    return null; // No devolver el usuario hasta que verifique
  } catch (error: unknown) {
    console.error('❌ [Firebase] Error en registro:', error);
    const firebaseError = error as { code?: string; message?: string };
    console.error('❌ [Firebase] Error code:', firebaseError.code);
    console.error('❌ [Firebase] Error message:', firebaseError.message);
    
    // Diagnóstico adicional
    if (firebaseError.code === 'auth/network-request-failed') {
      console.error('❌ [Firebase] Diagnóstico de red:');
      console.error('  - Auth Domain:', auth.config.authDomain);
      console.error('  - Current URL:', typeof window !== 'undefined' ? window.location.origin : 'server-side');
      console.error('  - User Agent:', typeof navigator !== 'undefined' ? navigator.userAgent : 'no navigator');
    }
    
    // Mejorar los mensajes de error para el usuario
    if (firebaseError.code === 'auth/network-request-failed') {
      throw new Error('Error de conectividad con Firebase. Es posible que localhost no esté autorizado en Firebase Console → Authentication → Settings → Authorized domains.');
    } else if (firebaseError.code === 'auth/email-already-in-use') {
      throw new Error('Este email ya está registrado. Intenta iniciar sesión.');
    } else if (firebaseError.code === 'auth/weak-password') {
      throw new Error('La contraseña es muy débil. Debe tener al menos 6 caracteres.');
    } else if (firebaseError.code === 'auth/invalid-email') {
      throw new Error('El formato del email no es válido.');
    } else {
      throw new Error(firebaseError.message || 'Error al crear la cuenta. Inténtalo más tarde.');
    }
  }
}

export async function signInUser(email: string, password: string): Promise<FirebaseUser | null> {
  try {
    const userCredential = await firebaseSignIn(auth, email, password);
    
    // Verificar si el email está verificado
    if (!userCredential.user.emailVerified) {
      console.warn('⚠️ [Firebase] Email no verificado para usuario:', userCredential.user.uid);
      
      // Cerrar sesión para que no pueda acceder sin verificar
      await firebaseSignOut(auth);
      
      throw new Error('Debes verificar tu email antes de poder acceder. Revisa tu bandeja de entrada y haz clic en el enlace de verificación.');
    }
    
    console.log('✅ [Firebase] Usuario autenticado correctamente:', userCredential.user.uid);
    return userCredential.user;
  } catch (error) {
    console.error('❌ [Firebase] Error en login:', error);
    throw error;
  }
}

export async function signOutUser(): Promise<void> {
  try {
    await firebaseSignOut(auth);
    console.log('✅ [Firebase] Usuario desconectado correctamente');
  } catch (error) {
    console.error('❌ [Firebase] Error al cerrar sesión:', error);
    throw error;
  }
}

export async function sendEmailVerificationToCurrentUser(): Promise<void> {
  try {
    if (!auth.currentUser) {
      throw new Error('No hay usuario autenticado');
    }
    
    if (auth.currentUser.emailVerified) {
      throw new Error('El email ya está verificado');
    }
    
    await sendEmailVerification(auth.currentUser);
    console.log('📧 [Firebase] Email de verificación reenviado');
  } catch (error) {
    console.error('❌ [Firebase] Error al enviar verificación:', error);
    throw error;
  }
}

export async function resendEmailVerification(email: string, password: string): Promise<void> {
  try {
    // Iniciar sesión temporalmente para reenviar la verificación
    const userCredential = await firebaseSignIn(auth, email, password);
    
    if (userCredential.user.emailVerified) {
      await firebaseSignOut(auth);
      throw new Error('El email ya está verificado. Puedes iniciar sesión normalmente.');
    }
    
    // Enviar email de verificación
    await sendEmailVerification(userCredential.user);
    
    // Cerrar sesión inmediatamente
    await firebaseSignOut(auth);
    
    console.log('📧 [Firebase] Email de verificación reenviado exitosamente');
  } catch (error) {
    console.error('❌ [Firebase] Error al reenviar verificación:', error);
    throw error;
  }
}

export async function updateUserProfile(updates: { displayName?: string }): Promise<void> {
  try {
    if (!auth.currentUser) {
      throw new Error('No hay usuario autenticado');
    }
    
    await updateProfile(auth.currentUser, updates);
    console.log('✅ [Firebase] Perfil actualizado correctamente');
  } catch (error) {
    console.error('❌ [Firebase] Error al actualizar perfil:', error);
    throw error;
  }
}

export async function updateUserPassword(newPassword: string): Promise<void> {
  try {
    if (!auth.currentUser) {
      throw new Error('No hay usuario autenticado');
    }
    
    if (newPassword.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }
    
    await updatePassword(auth.currentUser, newPassword);
    console.log('✅ [Firebase] Contraseña actualizada correctamente');
  } catch (error) {
    console.error('❌ [Firebase] Error al actualizar contraseña:', error);
    throw error;
  }
}

export async function resetUserPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
    console.log('✅ [Firebase] Email de recuperación enviado');
  } catch (error) {
    console.error('❌ [Firebase] Error al enviar email de recuperación:', error);
    throw error;
  }
}

export async function deleteUserAccount(): Promise<void> {
  try {
    if (!auth.currentUser) {
      throw new Error('No hay usuario autenticado');
    }
    
    const userId = auth.currentUser.uid;
    
    // Eliminar todos los datos del usuario
    await deleteAllUserData(userId);
    
    // Eliminar la cuenta del usuario
    await deleteUser(auth.currentUser);
    
    console.log('✅ [Firebase] Cuenta eliminada correctamente');
  } catch (error) {
    console.error('❌ [Firebase] Error al eliminar cuenta:', error);
    throw error;
  }
}

// Función auxiliar para eliminar todos los datos del usuario
async function deleteAllUserData(userId: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    
    // Eliminar entradas del diario
    const diaryEntriesRef = collection(db, 'diary_entries');
    const diaryQuery = query(diaryEntriesRef, where('user_id', '==', userId));
    const diarySnapshot = await getDocs(diaryQuery);
    
    diarySnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Eliminar personas
    const peopleRef = collection(db, 'people');
    const peopleQuery = query(peopleRef, where('user_id', '==', userId));
    const peopleSnapshot = await getDocs(peopleQuery);
    
    peopleSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Eliminar transcripciones de audio (si las hay)
    const transcriptionsRef = collection(db, 'audio_transcriptions');
    const transcriptionsQuery = query(transcriptionsRef, where('user_id', '==', userId));
    const transcriptionsSnapshot = await getDocs(transcriptionsQuery);
    
    transcriptionsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Ejecutar todas las eliminaciones
    await batch.commit();
    
    console.log('✅ [Firebase] Todos los datos del usuario eliminados');
  } catch (error) {
    console.error('❌ [Firebase] Error al eliminar datos del usuario:', error);
    throw error;
  }
}

// =====================================
// FUNCIONES AUXILIARES
// =====================================

export async function getUserInfo(): Promise<{ name: string; email: string | null }> {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { name: 'Usuario', email: null };
    }
    
    const name = user.displayName || 
                 user.email?.split('@')[0] || 
                 'Usuario';
    
    return {
      name,
      email: user.email || null
    };
  } catch (error) {
    console.error('❌ [Firebase] Error en getUserInfo:', error);
    return { name: 'Usuario', email: null };
  }
}

// Función para obtener detalles de una persona con formato compatible
export function getPersonDetailsWithDates(person: Person): Record<string, PersonDetailCategory> {
  const details: Record<string, PersonDetailCategory> = {};
  
  if (person.details) {
    for (const [key, value] of Object.entries(person.details)) {
      if (value && typeof value === 'object' && 'entries' in value) {
        details[key] = value as PersonDetailCategory;
      }
    }
  }
  
  return details;
}

// Función helper para detectar si dos textos son similares (para evitar duplicados)
function areSimilarTexts(text1: string, text2: string): boolean {
  // Normalizar textos (minúsculas, sin acentos, sin espacios extra)
  const normalize = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // quitar acentos
      .replace(/\s+/g, ' ') // normalizar espacios
      .trim();
  };
  
  const norm1 = normalize(text1);
  const norm2 = normalize(text2);
  
  // Si son exactamente iguales después de normalizar
  if (norm1 === norm2) return true;
  
  // Si uno contiene al otro (para casos como "examen de mates" vs "examen de matemáticas")
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  
  // Calcular similitud básica por palabras comunes
  const words1 = norm1.split(' ').filter(w => w.length > 2);
  const words2 = norm2.split(' ').filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return false;
  
  const commonWords = words1.filter(word => words2.includes(word));
  const similarity = commonWords.length / Math.max(words1.length, words2.length);
  
  // Si más del 70% de las palabras coinciden, consideramos que son similares
  return similarity > 0.7;
}

// Función para guardar información de personas extraída de las entradas del diario
export async function saveExtractedPersonInfo(
  personName: string, 
  information: Record<string, unknown>, 
  userId: string,
  entryDate?: string
): Promise<Person | null> {
  try {
    const validUUID = isValidUUID(userId) ? userId : generateUUID(userId);
    const date = entryDate || new Date().toISOString().split('T')[0];
    
    console.log(`🔍 [saveExtractedPersonInfo] Procesando: ${personName}`, information);
    
    // Verificar específicamente si "cumpleaños" llega con ñ
    if (information.cumpleaños || information.cumpleanos) {
      console.log('🎂 [saveExtractedPersonInfo] Verificando cumpleaños:');
      console.log('- Tiene "cumpleaños" (con ñ):', !!information.cumpleaños);
      console.log('- Tiene "cumpleanos" (sin ñ):', !!information.cumpleanos);
      console.log('- Valor con ñ:', information.cumpleaños);
      console.log('- Valor sin ñ:', information.cumpleanos);
    }
    
    // Buscar si la persona ya existe
    const peopleRef = collection(db, 'people');
    const q = query(
      peopleRef,
      where('user_id', '==', validUUID),
      where('name', '==', personName)
    );
    
    const querySnapshot = await getDocs(q);
    let person: Person;
    
    if (!querySnapshot.empty) {
      // Persona existente - actualizar detalles
      const existingDoc = querySnapshot.docs[0];
      const existingData = existingDoc.data();
      
      person = {
        id: existingDoc.id,
        user_id: existingData.user_id,
        name: existingData.name,
        details: existingData.details || {},
        created_at: timestampToISOString(existingData.created_at),
        updated_at: timestampToISOString(existingData.updated_at)
      };
      
      // Agregar nueva información a los detalles existentes
      const updatedDetails = { ...person.details };
      
      for (const [key, value] of Object.entries(information)) {
        if (value) {
          // Normalizar "cumpleanos" a "cumpleaños" si llegara sin ñ
          const normalizedKey = key === 'cumpleanos' ? 'cumpleaños' : key;
          
          if (!updatedDetails[normalizedKey]) {
            updatedDetails[normalizedKey] = { entries: [] };
          }
          
          const category = updatedDetails[normalizedKey] as PersonDetailCategory;
          
          // Manejar tanto strings como arrays
          if (typeof value === 'string') {
            const newEntry: PersonDetailEntry = {
              value: value,
              date: date
            };
            
            // Evitar duplicados exactos y similares
            const exists = category.entries.some(entry => {
              // Duplicado exacto
              if (entry.value === value && entry.date === date) return true;
              
              // Duplicado similar (especialmente importante para el mismo día)
              if (entry.date === date && areSimilarTexts(entry.value, value)) {
                console.log(`🔍 [saveExtractedPersonInfo] Evitando duplicado similar: "${value}" (ya existe: "${entry.value}")`);
                return true;
              }
              
              return false;
            });
            
            if (!exists) {
              category.entries.push(newEntry);
            }
          } else if (Array.isArray(value)) {
            // Procesar arrays (como "detalles")
            value.forEach((item: unknown) => {
              if (typeof item === 'string') {
                const newEntry: PersonDetailEntry = {
                  value: item,
                  date: date
                };
                
                // Evitar duplicados
                const exists = category.entries.some(
                  entry => entry.value === item && entry.date === date
                );
                
                if (!exists) {
                  category.entries.push(newEntry);
                }
              }
            });
          }
        }
      }
      
      person.details = updatedDetails;
      return await savePerson(person);
    } else {
      // Nueva persona
      const newDetails: Record<string, PersonDetailCategory> = {};
      
      for (const [key, value] of Object.entries(information)) {
        if (value) {
          // Normalizar "cumpleanos" a "cumpleaños" si llegara sin ñ
          const normalizedKey = key === 'cumpleanos' ? 'cumpleaños' : key;
          
          if (typeof value === 'string') {
            newDetails[normalizedKey] = {
              entries: [{
                value: value,
                date: date
              }]
            };
          } else if (Array.isArray(value)) {
            // Procesar arrays (como "detalles")
            const entries: PersonDetailEntry[] = [];
            value.forEach((item: unknown) => {
              if (typeof item === 'string') {
                entries.push({
                  value: item,
                  date: date
                });
              }
            });
            if (entries.length > 0) {
              newDetails[normalizedKey] = { entries };
            }
          }
        }
      }
      
      const newPerson: Partial<Person> = {
        user_id: validUUID,
        name: personName,
        details: newDetails
      };
      
      return await savePerson(newPerson);
    }
  } catch (error) {
    console.error('❌ [Firebase] Error al guardar información de persona:', error);
    return null;
  }
}

// Función para agregar detalles a una persona
export async function addPersonDetail(
  personId: string, 
  category: string, 
  value: string, 
  date?: string
): Promise<Person | null> {
  try {
    const personRef = doc(db, 'people', personId);
    const personDoc = await getDoc(personRef);
    
    if (!personDoc.exists()) {
      console.error('❌ [Firebase] Persona no encontrada');
      return null;
    }
    
    const personData = personDoc.data();
    const person: Person = {
      id: personDoc.id,
      user_id: personData.user_id,
      name: personData.name,
      details: personData.details || {},
      created_at: timestampToISOString(personData.created_at),
      updated_at: timestampToISOString(personData.updated_at)
    };
    
    const entryDate = date || new Date().toISOString().split('T')[0];
    
    if (!person.details[category]) {
      person.details[category] = { entries: [] };
    }
    
    const categoryData = person.details[category] as PersonDetailCategory;
    const newEntry: PersonDetailEntry = {
      value: value,
      date: entryDate
    };
    
    // Evitar duplicados
    const exists = categoryData.entries.some(
      entry => entry.value === value && entry.date === entryDate
    );
    
    if (!exists) {
      categoryData.entries.push(newEntry);
      return await savePerson(person);
    }
    
    return person;
  } catch (error) {
    console.error('❌ [Firebase] Error al agregar detalle de persona:', error);
    return null;
  }
}

// =====================================
// FUNCIONES DE TRANSCRIPCIONES DE AUDIO
// =====================================

export async function saveAudioTranscription(
  entryId: string, 
  audioUrl: string, 
  transcription: string
): Promise<AudioTranscription | null> {
  try {
    const transcriptionsRef = collection(db, 'audio_transcriptions');
    const newDocRef = doc(transcriptionsRef);
    
    const newTranscription = {
      entry_id: entryId,
      audio_url: audioUrl,
      transcription: transcription,
      created_at: serverTimestamp(),
    };
    
    await setDoc(newDocRef, newTranscription);
    
    const createdDoc = await getDoc(newDocRef);
    if (createdDoc.exists()) {
      const data = createdDoc.data();
      return {
        id: createdDoc.id,
        entry_id: data.entry_id,
        audio_url: data.audio_url,
        transcription: data.transcription,
        created_at: timestampToISOString(data.created_at)
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ [Firebase] Error al guardar transcripción:', error);
    return null;
  }
}

export async function getTranscriptionsByEntryId(entryId: string): Promise<AudioTranscription[]> {
  try {
    const transcriptionsRef = collection(db, 'audio_transcriptions');
    const q = query(
      transcriptionsRef,
      where('entry_id', '==', entryId),
      orderBy('created_at', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    
    const transcriptions: AudioTranscription[] = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        entry_id: data.entry_id,
        audio_url: data.audio_url,
        transcription: data.transcription,
        created_at: timestampToISOString(data.created_at)
      };
    });
    
    console.log(`✅ [Firebase] Se encontraron ${transcriptions.length} transcripciones`);
    return transcriptions;
  } catch (error) {
    console.error('❌ [Firebase] Error al obtener transcripciones:', error);
    return [];
  }
}

export { auth as firebaseAuth };
