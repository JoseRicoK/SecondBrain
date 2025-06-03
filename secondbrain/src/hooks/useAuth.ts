// Hook simplificado que usa el contexto de autenticación
import { useAuthContext } from '@/contexts/AuthContext';

export function useAuth() {
  return useAuthContext();
}
