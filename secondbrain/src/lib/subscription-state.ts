"use client";
import { create } from "zustand";
import { authenticatedFetch } from "./authenticated-fetch";
import type { MonthlyUsage, UserSubscription } from "./subscription-operations";
import type { PlanLimits, PlanType } from "@/lib/subscription-policy";
export interface SubscriptionSnapshot {
  currentPlan: PlanType;
  planLimits: PlanLimits;
  monthlyUsage: MonthlyUsage;
  subscription: UserSubscription;
  needsUpgrade: boolean;
  resetAt: string;
}
interface State {
  uid: string | null;
  snapshot: SubscriptionSnapshot | null;
  loading: boolean;
  error: string | null;
}
export const useSubscriptionState = create<State>(() => ({
  uid: null,
  snapshot: null,
  loading: false,
  error: null,
}));
let generation = 0;
let pending: {
  uid: string;
  promise: Promise<void>;
  refreshQueued?: boolean;
} | null = null;
let lastLoaded = 0;
export function clearSubscriptionState() {
  generation++;
  pending = null;
  lastLoaded = 0;
  useSubscriptionState.setState({
    uid: null,
    snapshot: null,
    loading: false,
    error: null,
  });
}
export function loadSubscriptionState(
  uid: string,
  force = false,
): Promise<void> {
  if (pending?.uid === uid) {
    if (force) pending.refreshQueued = true;
    return pending.promise;
  }
  const current = useSubscriptionState.getState();
  if (
    !force &&
    current.uid === uid &&
    current.snapshot &&
    Date.now() - lastLoaded < 2000
  )
    return Promise.resolve();
  const requestGeneration = ++generation;
  useSubscriptionState.setState({
    uid,
    snapshot: current.uid === uid ? current.snapshot : null,
    loading: !current.snapshot || current.uid !== uid,
    error: null,
  });
  const promise = (async () => {
    try {
      const response = await authenticatedFetch("/api/subscription/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("No se pudo comprobar la suscripción");
      const value: SubscriptionSnapshot = await response.json();
      if (
        !value.planLimits ||
        !value.monthlyUsage ||
        !["free", "pro", "elite"].includes(value.currentPlan)
      )
        throw new Error("Respuesta de suscripción incompleta");
      if (requestGeneration !== generation) return;
      value.monthlyUsage.lastUpdated = new Date(value.monthlyUsage.lastUpdated);
      value.subscription.createdAt = new Date(value.subscription.createdAt);
      value.subscription.updatedAt = new Date(value.subscription.updatedAt);
      if (value.subscription.currentPeriodEnd)
        value.subscription.currentPeriodEnd = new Date(
          value.subscription.currentPeriodEnd,
        );
      lastLoaded = Date.now();
      useSubscriptionState.setState({ snapshot: value, error: null });
    } catch (error) {
      if (requestGeneration === generation)
        useSubscriptionState.setState({
          snapshot: null,
          error:
            error instanceof Error
              ? error.message
              : "No se pudo cargar la cuota",
        });
    } finally {
      if (requestGeneration === generation) {
        const refreshQueued = pending?.refreshQueued;
        pending = null;
        useSubscriptionState.setState({ loading: false });
        if (refreshQueued) await loadSubscriptionState(uid, true);
      }
    }
  })();
  pending = { uid, promise };
  return promise;
}
