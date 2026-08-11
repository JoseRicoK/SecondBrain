import { supabase } from './supabase';

export async function testSupabaseConnection() {
  try {
    const { error } = await supabase.auth.getSession();
    if (error) throw error;
    return { success: true, message: 'La conexión con Supabase está configurada correctamente' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}
