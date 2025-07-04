'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { createUserProfile, UserProfile, getUserProfile } from '@/lib/subscription-operations';

// Función para verificar y actualizar suscripción expirada del usuario actual
async function checkAndUpdateExpiredSubscription(userId: string) {
  try {
    const userProfile = await getUserProfile(userId);
    
    if (userProfile?.subscription?.cancelAtPeriodEnd && 
        userProfile?.subscription?.status === 'active' &&
        userProfile?.subscription?.currentPeriodEnd) {
      
      const now = new Date();
      const periodEndDate = (userProfile.subscription.currentPeriodEnd as any)?.toDate ? 
        (userProfile.subscription.currentPeriodEnd as any).toDate() : 
        new Date(userProfile.subscription.currentPeriodEnd);
      
      // Si la suscripción ya expiró, actualizarla a gratuita
      if (periodEndDate <= now) {
        console.log('⏰ [Auth] Detectada suscripción expirada, actualizando a plan gratuito...');
        
        // Llamar al endpoint para actualizar
        await fetch('/api/subscription/update-manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId, 
            planType: 'free',
            cancelExpired: true 
          })
        });
        
        return true; // Indica que hubo cambios
      }
    }
    
    return false; // No hubo cambios
  } catch (error) {
    console.error('Error verificando suscripción expirada:', error);
    return false;
  }
}

interface FirebaseAuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isGoogleUser: boolean;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
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
        setUserProfile(null);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);

      // Si hay usuario, obtener/crear su perfil
      if (firebaseUser) {
        try {
          // Primero intentar obtener el perfil existente
          let profile = await getUserProfile(firebaseUser.uid);
          
          // Si no existe, crear uno nuevo CON PLAN FREE POR DEFECTO
          // El plan se actualizará cuando complete el pago
          if (!profile) {
            console.log('📝 [Firebase] Creando nuevo perfil de usuario...');
            await createUserProfile(firebaseUser.uid, {
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
              isGoogleUser: isGoogle,
            }, false); // false = no preservar suscripción (es nuevo)
            
            // Obtener el perfil recién creado
            profile = await getUserProfile(firebaseUser.uid);
          } else {
            // Actualizar último login SIN CAMBIAR EL PLAN
            await createUserProfile(firebaseUser.uid, {
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || profile.displayName,
              isGoogleUser: isGoogle,
            }, true); // true = preservar suscripción existente
            
            // Obtener el perfil actualizado
            profile = await getUserProfile(firebaseUser.uid);
          }
          
          setUserProfile(profile);
          
          // Verificar si la suscripción del usuario ha expirado
          if (profile) {
            const subscriptionUpdated = await checkAndUpdateExpiredSubscription(firebaseUser.uid);
            if (subscriptionUpdated) {
              // Si hubo cambios, recargar el perfil
              const updatedProfile = await getUserProfile(firebaseUser.uid);
              setUserProfile(updatedProfile);
              console.log('🔄 [Firebase] Perfil actualizado tras expiración de suscripción');
            }
          }
          
          console.log('✅ [Firebase] Usuario autenticado:', {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            isGoogleUser: isGoogle,
            plan: profile?.subscription.plan,
            status: profile?.subscription.status,
            isFirstLogin: profile?.isFirstLogin
          });
        } catch (error) {
          console.error('❌ [Firebase] Error gestionando perfil de usuario:', error);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
        console.log('👋 [Firebase] Usuario no autenticado');
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const refreshUserProfile = async () => {
    if (!user) return;
    
    try {
      console.log('🔄 [Firebase] Refrescando perfil de usuario...');
      const profile = await getUserProfile(user.uid);
      setUserProfile(profile);
      console.log('✅ [Firebase] Perfil refrescado:', profile?.subscription.plan);
    } catch (error) {
      console.error('❌ [Firebase] Error refrescando perfil:', error);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      console.log('👋 [Firebase] Cerrando sesión...');
      
      const { signOutUser } = await import('@/lib/firebase-operations');
      await signOutUser();
      
      console.log('✅ [Firebase] Sesión cerrada correctamente');
      setUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error('❌ [Firebase] Error cerrando sesión:', error);
    } finally {
      setLoading(false);
    }
  };

  // Verificar y actualizar suscripción expirada al iniciar sesión
  useEffect(() => {
    let mounted = true;

    const checkSubscription = async () => {
      if (!user) return;
      
      console.log('🔄 [Auth] Verificando suscripción del usuario...');
      const hasChanged = await checkAndUpdateExpiredSubscription(user.uid);
      
      if (hasChanged) {
        console.log('✅ [Auth] Suscripción actualizada a plan gratuito debido a expiración');
        
        // Refrescar perfil para obtener los últimos datos
        await refreshUserProfile();
      }
    };

    checkSubscription();

    return () => {
      mounted = false;
    };
  }, [user]);

  const value = {
    user,
    userProfile,
    loading,
    isGoogleUser,
    signOut,
    refreshUserProfile,
  };

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
}
