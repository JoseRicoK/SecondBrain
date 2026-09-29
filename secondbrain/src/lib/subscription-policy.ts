export const isExpired = (date?: Date) =>
  Boolean(
    date &&
    (!Number.isFinite(new Date(date).getTime()) ||
      new Date(date).getTime() <= Date.now()),
  );

export type PlanType = "free" | "pro" | "elite";

export interface PlanLimits {
  maxTranscriptions: number;
  maxPeopleManagement: number;
  hasAdvancedFeatures: boolean;
  hasPersonalChat: boolean;
  hasStatistics: boolean;
  // Nuevos límites de chat
  personalChatMessages: number;
  personChatMessages: number;
  statisticsAccess: number; // Número de veces que puede acceder a estadísticas por mes
}

// Límites por plan - Actualizados según especificaciones
export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    maxTranscriptions: -1, // ¡Ilimitado! (Muy generoso)
    maxPeopleManagement: -1, // ¡Ilimitado! (Muy generoso)
    hasAdvancedFeatures: false,
    hasPersonalChat: true,
    hasStatistics: false,
    personalChatMessages: 5, // 5 mensajes de chat personal por mes
    personChatMessages: 10, // 10 mensajes de chat con personas por mes
    statisticsAccess: 0, // No puede acceder a estadísticas
  },
  pro: {
    maxTranscriptions: -1, // ¡Ilimitado! (Muy generoso)
    maxPeopleManagement: -1, // ¡Ilimitado! (Muy generoso)
    hasAdvancedFeatures: true,
    hasPersonalChat: true,
    hasStatistics: true,
    personalChatMessages: 30, // 30 mensajes de chat personal por mes
    personChatMessages: 100, // 100 mensajes de chat con personas por mes
    statisticsAccess: 10, // 10 accesos a estadísticas por mes
  },
  elite: {
    maxTranscriptions: -1, // Ilimitado
    maxPeopleManagement: -1, // Ilimitado
    hasAdvancedFeatures: true,
    hasPersonalChat: true,
    hasStatistics: true,
    personalChatMessages: 100, // 100 mensajes de chat personal por mes
    personChatMessages: 500, // 500 mensajes de chat con personas por mes
    statisticsAccess: -1, // Acceso ilimitado a estadísticas
  },
};
