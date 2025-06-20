'use client';

import { useState, useEffect } from 'react';
import { useFirebaseAuthContext } from '@/contexts/FirebaseAuthContext';
import { 
  canUseFeature, 
  canCreateTranscription, 
  canManageMorePeople, 
  canSendPersonalChatMessage,
  canSendPersonChatMessage,
  canAccessStatistics,
  getEffectivePlan,
  needsSubscriptionUpgrade,
  PlanType,
  PLAN_LIMITS
} from '@/middleware/subscription';
import { getUserMonthlyUsage, MonthlyUsage } from '@/lib/subscription-operations';

export function useSubscription() {
  const { user, userProfile, loading } = useFirebaseAuthContext();
  const [currentPlan, setCurrentPlan] = useState<PlanType>('free');
  const [planLimits, setPlanLimits] = useState(PLAN_LIMITS.free);
  const [monthlyUsage, setMonthlyUsage] = useState<MonthlyUsage | null>(null);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  useEffect(() => {
    async function updateSubscriptionInfo() {
      if (loading || !user) {
        setSubscriptionLoading(false);
        return;
      }

      try {
        // Verificar si hay suscripciones expiradas antes de obtener el plan efectivo
        await checkAndUpdateExpiredSubscription(user.uid);
        
        const effectivePlan = await getEffectivePlan(user.uid);
        const upgradeNeeded = await needsSubscriptionUpgrade(user.uid);
        const usage = await getUserMonthlyUsage(user.uid);
        
        setCurrentPlan(effectivePlan);
        setPlanLimits(PLAN_LIMITS[effectivePlan]);
        setMonthlyUsage(usage);
        setNeedsUpgrade(upgradeNeeded);
      } catch (error) {
        console.error('❌ [useSubscription] Error obteniendo info de suscripción:', error);
        // En caso de error, asumir plan gratuito
        setCurrentPlan('free');
        setPlanLimits(PLAN_LIMITS.free);
        setMonthlyUsage(null);
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

  // Función para verificar y actualizar suscripciones expiradas
  const checkAndUpdateExpiredSubscription = async (userId: string) => {
    try {
      const response = await fetch('/api/subscription/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        const { subscription } = await response.json();
        
        // Verificar si la suscripción está marcada para cancelar y ha expirado
        if (subscription?.cancelAtPeriodEnd && subscription?.currentPeriodEnd) {
          const now = new Date();
          let periodEndDate: Date;
          
          // Manejar diferentes tipos de fecha
          if (subscription.currentPeriodEnd.toDate) {
            periodEndDate = subscription.currentPeriodEnd.toDate();
          } else {
            periodEndDate = new Date(subscription.currentPeriodEnd);
          }
          
          // Si ya expiró, actualizar a plan gratuito
          if (periodEndDate <= now && subscription.plan !== 'free') {
            console.log('⏰ [useSubscription] Suscripción expirada, cambiando a plan gratuito');
            
            await fetch('/api/subscription/update-manual', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                userId, 
                planType: 'free',
                clearCancellation: true 
              })
            });
            
            // Recargar la página para actualizar el estado
            window.location.reload();
          }
        }
      }
    } catch (error) {
      console.error('❌ [useSubscription] Error verificando expiración:', error);
    }
  };

  // Nuevas funciones de verificación para chat y estadísticas
  const checkCanSendPersonalChatMessage = async (): Promise<boolean> => {
    if (!user || !monthlyUsage) return false;
    return await canSendPersonalChatMessage(user.uid, monthlyUsage.personalChatMessages);
  };

  const checkCanSendPersonChatMessage = async (): Promise<boolean> => {
    if (!user || !monthlyUsage) return false;
    return await canSendPersonChatMessage(user.uid, monthlyUsage.personChatMessages);
  };

  const checkCanAccessStatistics = async (): Promise<boolean> => {
    if (!user || !monthlyUsage) return false;
    return await canAccessStatistics(user.uid, monthlyUsage.statisticsAccess);
  };

  // Función para refrescar el uso mensual
  const refreshMonthlyUsage = async () => {
    if (!user) return;
    try {
      const usage = await getUserMonthlyUsage(user.uid);
      setMonthlyUsage(usage);
    } catch (error) {
      console.error('❌ [useSubscription] Error refrescando uso mensual:', error);
    }
  };

  return {
    user,
    userProfile,
    currentPlan,
    planLimits,
    monthlyUsage,
    needsUpgrade,
    loading: loading || subscriptionLoading,
    checkCanUseFeature,
    checkCanCreateTranscription,
    checkCanManageMorePeople,
    checkCanSendPersonalChatMessage,
    checkCanSendPersonChatMessage,
    checkCanAccessStatistics,
    refreshMonthlyUsage,
  };
}
