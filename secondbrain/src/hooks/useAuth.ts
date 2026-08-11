import { useSupabaseAuthContext } from '@/contexts/SupabaseAuthContext';

export function useAuth() {
  return useSupabaseAuthContext();
}

export { useSupabaseAuthContext as useSupabaseAuth };
