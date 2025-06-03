'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Obtener la sesión inicial de manera más robusta
    const getInitialSession = async () => {
      try {
        console.log('🔍 Verificando sesión existente...');
        
        // Primero, intentar obtener la sesión del almacenamiento local
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Error obteniendo sesión:', error);
          if (mounted) {
            setUser(null);
            setSession(null);
            setLoading(false);
          }
          return;
        }

        if (session) {
          console.log('✅ Sesión encontrada:', {
            email: session.user.email,
            expires_at: session.expires_at,
            access_token: session.access_token ? '***' : 'null'
          });
          
          // Verificar si el token está expirado
          const now = Math.round(Date.now() / 1000);
          if (session.expires_at && session.expires_at < now) {
            console.log('⏰ Token expirado, intentando renovar...');
            
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              console.error('❌ Error renovando token:', refreshError);
              if (mounted) {
                setUser(null);
                setSession(null);
                setLoading(false);
              }
              return;
            }
            
            if (mounted && refreshData.session) {
              console.log('✅ Token renovado exitosamente');
              setUser(refreshData.session.user);
              setSession(refreshData.session);
            }
          } else {
            if (mounted) {
              setUser(session.user);
              setSession(session);
            }
          }
        } else {
          console.log('❌ No hay sesión guardada');
          if (mounted) {
            setUser(null);
            setSession(null);
          }
        }
      } catch (error) {
        console.error('❌ Error en getInitialSession:', error);
        if (mounted) {
          setUser(null);
          setSession(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Escuchar cambios en la autenticación con mejor logging
    const { data: { subscription } } =    supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        console.log(`🔄 Auth event: ${event}`, session ? `Usuario: ${session.user.email}` : 'Sin sesión');
        
        if (mounted) {
          setUser(session?.user ?? null);
          setSession(session);
          setLoading(false);
        }

        // Guardar información sobre el evento para debugging
        switch (event) {
          case 'SIGNED_IN':
            console.log('✅ Usuario autenticado correctamente');
            // Verificar que la sesión se guardó en localStorage
            if (typeof window !== 'undefined') {
              const stored = localStorage.getItem('secondbrain-auth-token');
              console.log('💾 Token guardado en localStorage:', !!stored);
            }
            break;
          case 'SIGNED_OUT':
            console.log('👋 Usuario desconectado');
            break;
          case 'TOKEN_REFRESHED':
            console.log('🔄 Token renovado automáticamente');
            break;
          case 'PASSWORD_RECOVERY':
            console.log('🔐 Recuperación de contraseña iniciada');
            break;
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      setLoading(true);
      console.log('👋 Cerrando sesión...');
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      console.log('✅ Sesión cerrada correctamente');
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('❌ Error cerrando sesión:', error);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    loading,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext debe usarse dentro de un AuthProvider');
  }
  return context;
}
