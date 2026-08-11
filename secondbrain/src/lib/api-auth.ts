import { supabase } from './supabase';

export async function getAuthenticatedUser(token?: string): Promise<{ uid: string; email?: string } | null> {
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { uid: data.user.id, email: data.user.email };
}
