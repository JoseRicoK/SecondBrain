'use client';

import { useState, useEffect } from 'react';
import { useFirebaseAuthContext } from '@/contexts/FirebaseAuthContext';
import { 
  canUseFeature, 
  canCreateTranscription, 
  canManageMorePeople, 
  getEffectivePlan,
  needsSubscriptionUpgrade,
  PlanType,
  PLAN_LIMITS
} from '@/middleware/subscription';

export function useSubscription() {
  const { user, userProfile, loading } = useFirebaseAuthContext();
  const [currentPlan, setCurrentPlan] = useState<PlanType>('free');
  const [planLimits, setPlanLimits] = useState(PLAN_LIMITS.free);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  useEffect(() => {
    async function updateSubscriptionInfo() {
      if (loading || !user) {
        setSubscriptionLoading(false);
        return;
      }

      try {
        const effectivePlan = await getEffectivePlan(user.uid);
        const upgradeNeeded = await needsSubscriptionUpgrade(user.uid);
        
        setCurrentPlan(effectivePlan);
        setPlanLimits(PLAN_LIMITS[effectivePlan]);
        setNeedsUpgrade(upgradeNeeded);
      } catch (error) {
        console.error('❌ [useSubscription] Error obteniendo info de suscripción:', error);
        // En caso de error, asumir plan gratuito
        setCurrentPlan('free');
        setPlanLimits(PLAN_LIMITS.free);
        setNeedsUpgrade(false);
      } finally {
        setSubscriptionLoading(false);
      }
    }

    updateSubscriptionInfo();
  }, [loading, user, userProfile]);

  // Funciones de verificación
  const checkCanUseFeature = async (feature: keyof typeof PLAN_LIMITS.free): Promise<boolean> => {
    if (!user) return false;
    return await canUseFeature(user.uid, feature);
  };

  const checkCanCreateTranscription = async (currentCount: number): Promise<boolean> => {
    if (!user) return false;
    return await canCreateTranscription(user.uid, currentCount);
  };

  const checkCanManageMorePeople = async (currentCount: number): Promise<boolean> => {
    if (!user) return false;
    return await canManageMorePeople(user.uid, currentCount);
  };

  return {
    user,
    userProfile,
    currentPlan,
    planLimits,
    needsUpgrade,
    loading: loading || subscriptionLoading,
    checkCanUseFeature,
    checkCanCreateTranscription,
    checkCanManageMorePeople,
  };
}
