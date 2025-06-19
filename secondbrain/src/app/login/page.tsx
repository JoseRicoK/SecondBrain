'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebaseAuthContext } from '@/contexts/FirebaseAuthContext';
import Auth from '@/components/Auth';
import Loading from '@/components/Loading';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useFirebaseAuthContext();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleAuthSuccess = (authenticatedUser: any) => {
    console.log('Usuario autenticado:', authenticatedUser.uid);
    // Redirigir a la app principal después del login
    router.push('/');
  };

  // Si ya está autenticado, redirigir a la app principal
  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return <Loading />;
  }

  if (user) {
    return <Loading />; // Mientras redirige
  }

  return <Auth onAuthSuccess={handleAuthSuccess} />;
}
