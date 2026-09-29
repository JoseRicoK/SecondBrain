"use client";
import { useEffect, useCallback } from "react";
import { useSupabaseAuthContext } from "@/contexts/SupabaseAuthContext";
import { PLAN_LIMITS, type PlanLimits } from "@/lib/subscription-policy";
import {
  clearSubscriptionState,
  loadSubscriptionState,
  useSubscriptionState,
} from "@/lib/subscription-state";

export function useSubscription() {
  const { user, userProfile, loading } = useSupabaseAuthContext();
  const state = useSubscriptionState();
  const uid = user?.uid;
  const snapshot = state.uid === uid ? state.snapshot : null;
  useEffect(() => {
    if (loading) return;
    if (!uid) {
      clearSubscriptionState();
      return;
    }
    void loadSubscriptionState(uid);
    const refresh = () => {
      if (document.visibilityState !== "hidden")
        void loadSubscriptionState(uid);
    };
    const changed = () => {
      void loadSubscriptionState(uid, true);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === "secondbrain-subscription-updated") changed();
    };
    const interval = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    window.addEventListener("subscription-updated", changed);
    window.addEventListener("storage", storage);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("subscription-updated", changed);
      window.removeEventListener("storage", storage);
    };
  }, [uid, loading]);
  const planLimits = snapshot?.planLimits || PLAN_LIMITS.free;
  const usage = snapshot?.monthlyUsage || null;
  const permitted = (count: number, maximum: number) =>
    Boolean(uid && snapshot && (maximum === -1 || count < maximum));
  const refreshMonthlyUsage = useCallback(async () => {
    if (uid) await loadSubscriptionState(uid, true);
  }, [uid]);
  return {
    user,
    userProfile:
      userProfile && snapshot
        ? { ...userProfile, subscription: snapshot.subscription }
        : userProfile,
    currentPlan: snapshot?.currentPlan || "free",
    planLimits,
    monthlyUsage: usage,
    needsUpgrade: snapshot?.needsUpgrade || false,
    resetAt: snapshot?.resetAt,
    error: state.uid === uid ? state.error : null,
    loading: loading || Boolean(uid && (state.uid !== uid || state.loading)),
    checkCanUseFeature: async (feature: keyof PlanLimits) =>
      Boolean(uid && snapshot && planLimits[feature]),
    checkCanCreateTranscription: async (count: number) =>
      permitted(count, planLimits.maxTranscriptions),
    checkCanManageMorePeople: async (count: number) =>
      permitted(count, planLimits.maxPeopleManagement),
    checkCanSendPersonalChatMessage: async () =>
      permitted(
        usage?.personalChatMessages ?? Infinity,
        planLimits.personalChatMessages,
      ),
    checkCanSendPersonChatMessage: async () =>
      permitted(
        usage?.personChatMessages ?? Infinity,
        planLimits.personChatMessages,
      ),
    checkCanAccessStatistics: async () =>
      permitted(
        usage?.statisticsAccess ?? Infinity,
        planLimits.statisticsAccess,
      ),
    refreshMonthlyUsage,
  };
}
