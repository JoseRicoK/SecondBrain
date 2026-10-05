'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AuthUser, signOutUser } from '@/lib/supabase-operations';
import { createUserProfile, UserProfile, getUserProfile } from '@/lib/subscription-operations';

interface SupabaseAuthContextType {
  user: AuthUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isGoogleUser: boolean;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(undefined);

export function useSupabaseAuthContext() {
  const context = useContext(SupabaseAuthContext);
  if (!context) throw new Error('useSupabaseAuthContext must be used within a SupabaseAuthProvider');
  return context;
}

function toAppUser(user: { id: string; email?: string; email_confirmed_at?: string | null; app_metadata: Record<string, unknown>; user_metadata: Record<string, unknown> }): AuthUser {
  const providers = user.app_metadata.providers;
  const hasGoogle = user.app_metadata.provider === 'google' || (Array.isArray(providers) && providers.includes('google'));
  const provider = hasGoogle ? 'google.com' : String(user.app_metadata.provider || 'email');
  return {
    uid: user.id,
    email: user.email || null,
    displayName: String(user.user_metadata.display_name || user.user_metadata.full_name || user.email?.split('@')[0] || ''),
    emailVerified: Boolean(user.email_confirmed_at),
    providerData: [{ providerId: provider }],
    photoURL: String(user.user_metadata.avatar_url || user.user_metadata.picture || '') || null,
    getIdToken: async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error('No hay una sesión activa');
      return data.session.access_token;
    },
  };
}

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const authRevision = useRef(0);

  const loadProfile = async (appUser: AuthUser, provider: string) => {
    let profile = await getUserProfile(appUser.uid);
    await createUserProfile(appUser.uid, {
      email: appUser.email || '',
      displayName: appUser.displayName || appUser.email?.split('@')[0] || '',
      isGoogleUser: provider === 'google',
    }, Boolean(profile));
    profile = await getUserProfile(appUser.uid);
    return profile;
  };

  useEffect(() => {
    let mounted = true;
    let pendingWork: ReturnType<typeof setTimeout> | undefined;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      clearTimeout(pendingWork);
      const request = ++authRevision.current;
      if (!session?.user) {
        setUser(null);
        setUserProfile(null);
        setIsGoogleUser(false);
        setLoading(false);
        return;
      }
      const providers = session.user.app_metadata.providers;
      const provider = Array.isArray(providers) && providers.includes('google')
        ? 'google' : String(session.user.app_metadata.provider || 'email');
      if (!session.user.email_confirmed_at && provider !== 'google') {
        setUser(null);
        setUserProfile(null);
        setIsGoogleUser(false);
        setLoading(false);
        pendingWork = setTimeout(() => {
          if (mounted && authRevision.current === request) {
            void supabase.auth.signOut().catch(error => console.error('Error cerrando sesión no verificada:', error));
          }
        }, 0);
        return;
      }
      const appUser = toAppUser(session.user);
      setUser(appUser);
      setUserProfile(null);
      setIsGoogleUser(provider === 'google');
      // Supabase holds its auth lock during this callback. Profile queries must
      // start after it returns so token refresh/getSession cannot deadlock.
      pendingWork = setTimeout(async () => {
        if (!mounted || authRevision.current !== request) return;
        try {
          const profile = await loadProfile(appUser, provider);
          if (mounted && authRevision.current === request) setUserProfile(profile);
        } catch (error) {
          console.error('Error gestionando perfil de usuario:', error);
          if (mounted && authRevision.current === request) setUserProfile(null);
        }
        if (mounted && authRevision.current === request) setLoading(false);
      }, 0);
    });
    return () => { mounted = false; clearTimeout(pendingWork); authRevision.current++; listener.subscription.unsubscribe(); };
  }, []);

  const refreshUserProfile = async () => {
    const request = authRevision.current;
    if (user) {
      const profile = await getUserProfile(user.uid);
      if (authRevision.current === request) setUserProfile(profile);
    }
  };
  const signOut = async () => {
    authRevision.current++;
    setLoading(true);
    try { await signOutUser(); } finally { setUser(null); setUserProfile(null); setIsGoogleUser(false); setLoading(false); }
  };

  return <SupabaseAuthContext.Provider value={{ user, userProfile, loading, isGoogleUser, signOut, refreshUserProfile }}>{children}</SupabaseAuthContext.Provider>;
}
