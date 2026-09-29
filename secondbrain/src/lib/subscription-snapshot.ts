import { getDatabaseClient } from "./supabase";
import { getUserMonthlyUsage, getUserProfile } from "./subscription-operations";
import {
  PLAN_LIMITS,
  isExpired,
  type PlanType,
} from "@/lib/subscription-policy";

export async function getSubscriptionSnapshot(uid: string) {
  const profile = await getUserProfile(uid);
  if (!profile) throw new Error("Profile not found");
  const subscription = profile.subscription;
  const currentPlan: PlanType =
    subscription.status === "active" &&
    !isExpired(subscription.currentPeriodEnd)
      ? subscription.plan
      : "free";
  const [{ data: catalog, error }, monthlyUsage] = await Promise.all([
    getDatabaseClient()
      .from("subscription_plans")
      .select("*")
      .eq("id", currentPlan)
      .single(),
    getUserMonthlyUsage(uid),
  ]);
  if (error || !catalog) throw error || new Error("Plan limits unavailable");
  const planLimits = {
    ...PLAN_LIMITS[currentPlan],
    personalChatMessages: catalog.personal_chat_messages,
    personChatMessages: catalog.person_chat_messages,
    statisticsAccess: catalog.statistics_access,
    hasStatistics: catalog.statistics_access !== 0,
  };
  const resetAt = new Date(`${monthlyUsage.month}-01T00:00:00Z`);
  resetAt.setUTCMonth(resetAt.getUTCMonth() + 1);
  return {
    subscription,
    isFirstLogin: profile.isFirstLogin,
    currentPlan,
    planLimits,
    monthlyUsage,
    resetAt,
    needsUpgrade: subscription.plan !== "free" && currentPlan === "free",
  };
}
