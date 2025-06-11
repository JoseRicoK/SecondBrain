// Hook para autenticación con Firebase
// Para la migración, usaremos Firebase por defecto
import { useFirebaseAuthContext } from '@/contexts/FirebaseAuthContext';

export function useAuth() {
  return useFirebaseAuthContext();
}

// Hook para compatibilidad durante la migración
export { useFirebaseAuthContext as useFirebaseAuth };
