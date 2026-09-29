'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
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
  const provider = user.app_metadata.provider === 'google' ? 'google.com' : String(user.app_metadata.provider || 'email');
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

  const loadProfile = async (appUser: AuthUser, provider: string) => {
    let profile = await getUserProfile(appUser.uid);
    await createUserProfile(appUser.uid, {
      email: appUser.email || '',
      displayName: appUser.displayName || appUser.email?.split('@')[0] || '',
      isGoogleUser: provider === 'google',
    }, Boolean(profile));
    profile = await getUserProfile(appUser.uid);
    setUserProfile(profile);
  };

  useEffect(() => {
    let mounted = true;
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
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
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }
      const appUser = toAppUser(session.user);
      setUser(appUser);
      setIsGoogleUser(provider === 'google');
      try {
        await loadProfile(appUser, provider);
      } catch (error) {
        console.error('Error gestionando perfil de usuario:', error);
        setUserProfile(null);
      }
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const refreshUserProfile = async () => {
    if (user) setUserProfile(await getUserProfile(user.uid));
  };
  const signOut = async () => {
    setLoading(true);
    try { await signOutUser(); } finally { setUser(null); setUserProfile(null); setLoading(false); }
  };

  return <SupabaseAuthContext.Provider value={{ user, userProfile, loading, isGoogleUser, signOut, refreshUserProfile }}>{children}</SupabaseAuthContext.Provider>;
}
