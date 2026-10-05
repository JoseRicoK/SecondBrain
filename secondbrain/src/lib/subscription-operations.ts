import { getDatabaseClient } from "./supabase";

export interface MonthlyUsage {
  personalChatMessages: number;
  personChatMessages: number;
  statisticsAccess: number;
  month: string;
  lastUpdated: Date;
}
export interface UserSubscription {
  plan: "free" | "pro" | "elite";
  status: "active" | "inactive" | "canceled" | "past_due";
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  createdAt: Date;
  updatedAt: Date;
  monthlyUsage?: MonthlyUsage;
}
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  isGoogleUser: boolean;
  subscription: UserSubscription;
  isFirstLogin?: boolean;
  hasCompletedFirstPayment?: boolean;
  showWelcomeModal?: boolean;
  createdAt: Date;
  lastLoginAt: Date;
}

const now = () => new Date();
function deserialize(data: Record<string, unknown>): UserProfile {
  const typed = Array.isArray(data.subscriptions)
    ? data.subscriptions[0]
    : data.subscriptions;
  const subscription = (
    typed
      ? {
          plan: typed.plan,
          status: typed.status,
          stripeCustomerId: typed.stripe_customer_id,
          stripeSubscriptionId: typed.stripe_subscription_id,
          currentPeriodEnd: typed.current_period_end,
          cancelAtPeriodEnd: typed.cancel_at_period_end,
          createdAt: typed.created_at,
          updatedAt: typed.updated_at,
        }
      : {}
  ) as Record<string, unknown>;
  return {
    uid: String(data.uid),
    email: String(data.email || ""),
    displayName: String(data.display_name || ""),
    isGoogleUser: Boolean(data.is_google_user),
    subscription: {
      ...subscription,
      plan: (subscription.plan || "free") as UserSubscription["plan"],
      status: (subscription.status || "inactive") as UserSubscription["status"],
      createdAt: new Date(String(subscription.createdAt || data.created_at)),
      updatedAt: new Date(String(subscription.updatedAt || data.created_at)),
      currentPeriodEnd: subscription.currentPeriodEnd
        ? new Date(String(subscription.currentPeriodEnd))
        : undefined,
    },
    isFirstLogin: Boolean(data.is_first_login),
    hasCompletedFirstPayment: Boolean(data.has_completed_first_payment),
    showWelcomeModal: Boolean(data.show_welcome_modal),
    createdAt: new Date(String(data.created_at)),
    lastLoginAt: new Date(String(data.last_login_at)),
  };
}

export async function createUserProfile(
  uid: string,
  userData: Partial<UserProfile>,
  preserveSubscription = true,
): Promise<void> {
  const database = getDatabaseClient();
  const existing = await getUserProfile(uid);
  if (!existing) {
    const { error } = await database.from("profiles").insert({
      uid,
      email: userData.email || "",
      display_name: userData.displayName || "",
      is_google_user: userData.isGoogleUser || false,
    });
    if (error) throw error;
    return;
  }
  const payload: Record<string, unknown> = {
    email: userData.email ?? existing.email,
    display_name: userData.displayName ?? existing.displayName,
    is_google_user: userData.isGoogleUser ?? existing.isGoogleUser,
    last_login_at: now().toISOString(),
  };
  if (!preserveSubscription && userData.subscription)
    await updateUserSubscription(uid, userData.subscription);
  const { error } = await database
    .from("profiles")
    .update(payload)
    .eq("uid", uid);
  if (error) throw error;
}
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const { data, error } = await getDatabaseClient()
    .from("profiles")
    .select("*, subscriptions(*)")
    .eq("uid", uid)
    .maybeSingle();
  if (error) {
    console.error("Error al obtener perfil:", error);
    return null;
  }
  return data ? deserialize(data) : null;
}
export async function updateUserSubscription(
  uid: string,
  updates: Partial<UserSubscription>,
): Promise<void> {
  const fields: Record<string, string> = {
    plan: "plan",
    status: "status",
    stripeCustomerId: "stripe_customer_id",
    stripeSubscriptionId: "stripe_subscription_id",
    currentPeriodEnd: "current_period_end",
    cancelAtPeriodEnd: "cancel_at_period_end",
  };
  const payload: Record<string, unknown> = { updated_at: now().toISOString() };
  for (const [key, column] of Object.entries(fields)) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      const value = updates[key as keyof UserSubscription];
      payload[column] =
        value instanceof Date ? value.toISOString() : (value ?? null);
    }
  }
  const { data, error } = await getDatabaseClient()
    .from("subscriptions")
    .update(payload)
    .eq("user_id", uid)
    .select("user_id")
    .single();
  if (error || !data) throw error || new Error("Subscription not found");
}
export async function hasActiveSubscription(uid: string) {
  const profile = await getUserProfile(uid);
  return Boolean(
    profile &&
    (profile.subscription.plan === "free" ||
      (profile.subscription.status === "active" &&
        (!profile.subscription.currentPeriodEnd ||
          profile.subscription.currentPeriodEnd > new Date()))),
  );
}
export async function markWelcomeComplete(uid: string) {
  const { error } = await getDatabaseClient()
    .from("profiles")
    .update({ is_first_login: false })
    .eq("uid", uid);
  if (error) throw error;
}
export async function markFirstPaymentComplete(uid: string) {
  const { error } = await getDatabaseClient()
    .from("profiles")
    .update({ has_completed_first_payment: true, show_welcome_modal: true })
    .eq("uid", uid)
    .eq("has_completed_first_payment", false);
  if (error) throw error;
}
export async function markWelcomeModalSeen(uid: string) {
  const { error } = await getDatabaseClient()
    .from("profiles")
    .update({ show_welcome_modal: false })
    .eq("uid", uid);
  if (error) throw error;
}
export async function findUserByStripeCustomerId(customerId: string) {
  const { data, error } = await getDatabaseClient()
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) {
    console.error("Error buscando cliente de Stripe:", error);
    return null;
  }
  return data?.user_id || null;
}
const currentMonth = () => new Date().toISOString().slice(0, 7);
function defaultUsage(): MonthlyUsage {
  return {
    personalChatMessages: 0,
    personChatMessages: 0,
    statisticsAccess: 0,
    month: currentMonth(),
    lastUpdated: now(),
  };
}
export async function getUserMonthlyUsage(uid: string): Promise<MonthlyUsage> {
  const { data, error } = await getDatabaseClient().rpc("read_monthly_usage", {
    p_user_id: uid,
  });
  if (error || !data) throw error || new Error("Usage unavailable");
  const usage = defaultUsage();
  for (const row of data) {
    if (
      [
        "personalChatMessages",
        "personChatMessages",
        "statisticsAccess",
      ].includes(row.feature)
    )
      usage[row.feature as UsageFeature] = row.used + row.reserved;
  }
  return usage;
}
export type UsageFeature =
  "personalChatMessages" | "personChatMessages" | "statisticsAccess";
export type UsageReservation = {
  allowed: boolean;
  id?: string;
  currentUsage: number;
  limit: number;
  busy?: boolean;
};
export async function reserveUsage(
  uid: string,
  feature: UsageFeature,
): Promise<UsageReservation> {
  const { data, error } = await getDatabaseClient().rpc("reserve_usage", {
    p_user_id: uid,
    p_feature: feature,
  });
  if (error || !data) throw error || new Error("Quota unavailable");
  return data;
}
export async function finishUsage(
  uid: string,
  id: string,
  success: boolean,
): Promise<void> {
  const { error } = await getDatabaseClient().rpc("finish_usage", {
    p_user_id: uid,
    p_id: id,
    p_success: success,
  });
  if (error) throw error;
}
// Compatibility for callers; cost-bearing routes must reserve before invoking the provider.
async function incrementUsage(uid: string, feature: UsageFeature) {
  const reservation = await reserveUsage(uid, feature);
  if (!reservation.allowed || !reservation.id)
    throw new Error("Monthly limit exceeded");
  await finishUsage(uid, reservation.id, true);
}
export const incrementPersonalChatUsage = (uid: string) =>
  incrementUsage(uid, "personalChatMessages");
export const incrementPersonChatUsage = (uid: string) =>
  incrementUsage(uid, "personChatMessages");
export const incrementStatisticsAccess = (uid: string) =>
  incrementUsage(uid, "statisticsAccess");
