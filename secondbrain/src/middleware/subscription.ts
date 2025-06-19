import { getUserProfile } from '@/lib/subscription-operations';

export type PlanType = 'free' | 'basic' | 'pro' | 'elite';

export interface PlanLimits {
  maxTranscriptions: number;
  maxPeopleManagement: number;
  hasAdvancedFeatures: boolean;
  hasPersonalChat: boolean;
  hasStatistics: boolean;
}

// Límites por plan
export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    maxTranscriptions: 5,
    maxPeopleManagement: 0,
    hasAdvancedFeatures: false,
    hasPersonalChat: false,
    hasStatistics: false,
  },
  basic: {
    maxTranscriptions: 50,
    maxPeopleManagement: 10,
    hasAdvancedFeatures: false,
    hasPersonalChat: true,
    hasStatistics: true,
  },
  pro: {
    maxTranscriptions: 200,
    maxPeopleManagement: 50,
    hasAdvancedFeatures: true,
    hasPersonalChat: true,
    hasStatistics: true,
  },
  elite: {
    maxTranscriptions: -1, // Ilimitado
    maxPeopleManagement: -1, // Ilimitado
    hasAdvancedFeatures: true,
    hasPersonalChat: true,
    hasStatistics: true,
  },
};

// Verificar si el usuario puede usar una característica específica
export async function canUseFeature(
  uid: string, 
  feature: keyof PlanLimits
): Promise<boolean> {
  try {
    const profile = await getUserProfile(uid);
    if (!profile) return false;

    const { plan, status } = profile.subscription;
    
    // Si el plan no es gratuito pero no está activo, solo puede usar características gratuitas
    if (plan !== 'free' && status !== 'active') {
      const freeLimits = PLAN_LIMITS.free;
      return freeLimits[feature] as boolean;
    }

    const limits = PLAN_LIMITS[plan];
    return limits[feature] as boolean;
  } catch (error) {
    console.error('❌ [Subscription] Error verificando característica:', error);
    return false; // En caso de error, denegar acceso
  }
}

// Verificar si el usuario puede crear más transcripciones
export async function canCreateTranscription(
  uid: string, 
  currentCount: number
): Promise<boolean> {
  try {
    const profile = await getUserProfile(uid);
    if (!profile) return false;

    const { plan, status } = profile.subscription;
    
    // Si el plan no es gratuito pero no está activo, aplicar límites gratuitos
    let activePlan = plan;
    if (plan !== 'free' && status !== 'active') {
      activePlan = 'free';
    }

    const limits = PLAN_LIMITS[activePlan];
    
    // -1 significa ilimitado
    if (limits.maxTranscriptions === -1) return true;
    
    return currentCount < limits.maxTranscriptions;
  } catch (error) {
    console.error('❌ [Subscription] Error verificando límite de transcripciones:', error);
    return false;
  }
}

// Verificar si el usuario puede gestionar más personas
export async function canManageMorePeople(
  uid: string, 
  currentCount: number
): Promise<boolean> {
  try {
    const profile = await getUserProfile(uid);
    if (!profile) return false;

    const { plan, status } = profile.subscription;
    
    // Si el plan no es gratuito pero no está activo, aplicar límites gratuitos
    let activePlan = plan;
    if (plan !== 'free' && status !== 'active') {
      activePlan = 'free';
    }

    const limits = PLAN_LIMITS[activePlan];
    
    // -1 significa ilimitado
    if (limits.maxPeopleManagement === -1) return true;
    
    return currentCount < limits.maxPeopleManagement;
  } catch (error) {
    console.error('❌ [Subscription] Error verificando límite de personas:', error);
    return false;
  }
}

// Obtener el plan efectivo del usuario (considerando si está activo)
export async function getEffectivePlan(uid: string): Promise<PlanType> {
  try {
    const profile = await getUserProfile(uid);
    if (!profile) return 'free';

    const { plan, status } = profile.subscription;
    
    // Si el plan no es gratuito pero no está activo, se considera gratuito
    if (plan !== 'free' && status !== 'active') {
      return 'free';
    }

    return plan;
  } catch (error) {
    console.error('❌ [Subscription] Error obteniendo plan efectivo:', error);
    return 'free';
  }
}

// Verificar si el usuario necesita actualizar su suscripción
export async function needsSubscriptionUpgrade(uid: string): Promise<boolean> {
  try {
    const profile = await getUserProfile(uid);
    if (!profile) return true;

    const { plan, status } = profile.subscription;
    
    // Si es plan gratuito, siempre puede necesitar upgrade
    if (plan === 'free') return false; // No "necesita" upgrade, pero puede hacerlo
    
    // Si tiene un plan de pago pero no está activo, necesita reactivar
    return status !== 'active';
  } catch (error) {
    console.error('❌ [Subscription] Error verificando necesidad de upgrade:', error);
    return true;
  }
}
