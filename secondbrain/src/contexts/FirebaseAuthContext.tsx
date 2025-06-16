'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface FirebaseAuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isGoogleUser: boolean;
  signOut: () => Promise<void>;
}

const FirebaseAuthContext = createContext<FirebaseAuthContextType | undefined>(undefined);

export function useFirebaseAuthContext() {
  const context = useContext(FirebaseAuthContext);
  if (context === undefined) {
    throw new Error('useFirebaseAuthContext must be used within a FirebaseAuthProvider');
  }
  return context;
}

export function FirebaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGoogleUser, setIsGoogleUser] = useState(false);

  useEffect(() => {
    let mounted = true;

    console.log('🔍 [Firebase] Inicializando listener de autenticación...');

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;

      console.log(
        '🔄 [Firebase] Estado de autenticación cambió:',
        firebaseUser ? `Usuario: ${firebaseUser.email}` : 'Sin usuario'
      );

      // Verificar si el usuario es de Google
      const isGoogle = firebaseUser?.providerData.some(
        provider => provider.providerId === 'google.com'
      ) || false;
      
      setIsGoogleUser(isGoogle);

      // Ignorar usuarios que aún no verificaron su email SOLO si no son de Google
      if (firebaseUser && !firebaseUser.emailVerified && !isGoogle) {
        console.log('⚠️ [Firebase] Email no verificado, cerrando sesión...');
        await auth.signOut();
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
        console.log('✅ [Firebase] Usuario autenticado:', {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          isGoogleUser: isGoogle
        });
      } else {
        console.log('👋 [Firebase] Usuario no autenticado');
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      setLoading(true);
      console.log('👋 [Firebase] Cerrando sesión...');
      
      const { signOutUser } = await import('@/lib/firebase-operations');
      await signOutUser();
      
      console.log('✅ [Firebase] Sesión cerrada correctamente');
      setUser(null);
    } catch (error) {
      console.error('❌ [Firebase] Error cerrando sesión:', error);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    isGoogleUser,
    signOut,
  };

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
}
