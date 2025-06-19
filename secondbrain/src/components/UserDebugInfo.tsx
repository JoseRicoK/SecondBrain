'use client';

import { useFirebaseAuthContext } from '@/contexts/FirebaseAuthContext';
import { useSubscription } from '@/hooks/useSubscription';

export default function UserDebugInfo() {
  const { user, userProfile, loading } = useFirebaseAuthContext();
  const { currentPlan, planLimits } = useSubscription();

  if (loading) return null;
  if (!user) return null;

  // Solo mostrar en desarrollo
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="fixed top-4 right-4 bg-black text-white p-4 rounded-lg text-xs max-w-sm z-50 opacity-75">
      <h4 className="font-bold mb-2">🐛 Debug Info</h4>
      <div className="space-y-1">
        <div><strong>UID:</strong> {user.uid}</div>
        <div><strong>Email:</strong> {user.email}</div>
        <div><strong>Google User:</strong> {userProfile?.isGoogleUser ? 'Sí' : 'No'}</div>
        <div><strong>First Login:</strong> {userProfile?.isFirstLogin ? 'Sí' : 'No'}</div>
        <div><strong>Plan:</strong> {userProfile?.subscription.plan || 'No profile'}</div>
        <div><strong>Status:</strong> {userProfile?.subscription.status || 'No profile'}</div>
        <div><strong>Current Plan:</strong> {currentPlan}</div>
        <div><strong>Stripe Customer:</strong> {userProfile?.subscription.stripeCustomerId || 'None'}</div>
      </div>
    </div>
  );
}
