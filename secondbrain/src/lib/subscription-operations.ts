import { getDatabaseClient } from './supabase';

export interface MonthlyUsage { personalChatMessages: number; personChatMessages: number; statisticsAccess: number; month: string; lastUpdated: Date; }
export interface UserSubscription {
  plan: 'free' | 'pro' | 'elite'; status: 'active' | 'inactive' | 'canceled' | 'past_due';
  stripeCustomerId?: string; stripeSubscriptionId?: string; currentPeriodEnd?: Date; cancelAtPeriodEnd?: boolean;
  createdAt: Date; updatedAt: Date; monthlyUsage?: MonthlyUsage;
}
export interface UserProfile {
  uid: string; email: string; displayName: string; isGoogleUser: boolean; subscription: UserSubscription;
  isFirstLogin?: boolean; hasCompletedFirstPayment?: boolean; showWelcomeModal?: boolean; createdAt: Date; lastLoginAt: Date;
}

const now = () => new Date();
const serialize = (subscription: UserSubscription) => JSON.parse(JSON.stringify(subscription));
function deserialize(data: Record<string, unknown>): UserProfile {
  const subscription = (data.subscription || {}) as Record<string, unknown>;
  const usage = subscription.monthlyUsage as Record<string, unknown> | undefined;
  return {
    uid: String(data.uid), email: String(data.email || ''), displayName: String(data.display_name || ''), isGoogleUser: Boolean(data.is_google_user),
    subscription: {
      ...subscription, plan: (subscription.plan || 'free') as UserSubscription['plan'], status: (subscription.status || 'inactive') as UserSubscription['status'],
      createdAt: new Date(String(subscription.createdAt || data.created_at)), updatedAt: new Date(String(subscription.updatedAt || data.created_at)),
      currentPeriodEnd: subscription.currentPeriodEnd ? new Date(String(subscription.currentPeriodEnd)) : undefined,
      monthlyUsage: usage ? { ...usage, personalChatMessages: Number(usage.personalChatMessages || 0), personChatMessages: Number(usage.personChatMessages || 0), statisticsAccess: Number(usage.statisticsAccess || 0), month: String(usage.month), lastUpdated: new Date(String(usage.lastUpdated)) } : undefined,
    },
    isFirstLogin: Boolean(data.is_first_login), hasCompletedFirstPayment: Boolean(data.has_completed_first_payment), showWelcomeModal: Boolean(data.show_welcome_modal),
    createdAt: new Date(String(data.created_at)), lastLoginAt: new Date(String(data.last_login_at)),
  };
}
function defaultSubscription(): UserSubscription { const value = now(); return { plan: 'free', status: 'inactive', createdAt: value, updatedAt: value }; }

export async function createUserProfile(uid: string, userData: Partial<UserProfile>, preserveSubscription = true): Promise<void> {
  const database = getDatabaseClient();
  const existing = await getUserProfile(uid);
  if (!existing) {
    const { error } = await database.from('profiles').insert({ uid, email: userData.email || '', display_name: userData.displayName || '', is_google_user: userData.isGoogleUser || false });
    if (error) throw error;
    return;
  }
  const payload: Record<string, unknown> = { email: userData.email ?? existing.email, display_name: userData.displayName ?? existing.displayName, is_google_user: userData.isGoogleUser ?? existing.isGoogleUser, last_login_at: now().toISOString() };
  if (!preserveSubscription && userData.subscription) payload.subscription = serialize(userData.subscription);
  const { error } = await database.from('profiles').update(payload).eq('uid', uid);
  if (error) throw error;
}
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const { data, error } = await getDatabaseClient().from('profiles').select('*').eq('uid', uid).maybeSingle();
  if (error) { console.error('Error al obtener perfil:', error); return null; }
  return data ? deserialize(data) : null;
}
export async function updateUserSubscription(uid: string, updates: Partial<UserSubscription>): Promise<void> {
  const profile = await getUserProfile(uid);
  const subscription = { ...(profile?.subscription || defaultSubscription()), ...updates, updatedAt: now() };
  const { error } = await getDatabaseClient().from('profiles').update({ subscription: serialize(subscription) }).eq('uid', uid);
  if (error) throw error;
}
export async function hasActiveSubscription(uid: string) { const profile = await getUserProfile(uid); return Boolean(profile && (profile.subscription.plan === 'free' || profile.subscription.status === 'active')); }
export async function markWelcomeComplete(uid: string) { const { error } = await getDatabaseClient().from('profiles').update({ is_first_login: false }).eq('uid', uid); if (error) throw error; }
export async function markFirstPaymentComplete(uid: string) { const { error } = await getDatabaseClient().from('profiles').update({ has_completed_first_payment: true, show_welcome_modal: true }).eq('uid', uid); if (error) throw error; }
export async function markWelcomeModalSeen(uid: string) { const { error } = await getDatabaseClient().from('profiles').update({ show_welcome_modal: false }).eq('uid', uid); if (error) throw error; }
export async function findUserByStripeCustomerId(customerId: string) {
  const { data, error } = await getDatabaseClient().from('profiles').select('uid').eq('subscription->>stripeCustomerId', customerId).maybeSingle();
  if (error) { console.error('Error buscando cliente de Stripe:', error); return null; }
  return data?.uid || null;
}
const currentMonth = () => new Date().toISOString().slice(0, 7);
function defaultUsage(): MonthlyUsage { return { personalChatMessages: 0, personChatMessages: 0, statisticsAccess: 0, month: currentMonth(), lastUpdated: now() }; }
function normalizeUsage(usage?: MonthlyUsage) { return !usage || usage.month !== currentMonth() ? defaultUsage() : usage; }
export async function getUserMonthlyUsage(uid: string) { return normalizeUsage((await getUserProfile(uid))?.subscription.monthlyUsage); }
async function updateUsage(uid: string, key: keyof Pick<MonthlyUsage, 'personalChatMessages' | 'personChatMessages' | 'statisticsAccess'>) {
  const profile = await getUserProfile(uid); if (!profile) return;
  const usage = normalizeUsage(profile.subscription.monthlyUsage); usage[key] += 1; usage.lastUpdated = now();
  await updateUserSubscription(uid, { monthlyUsage: usage });
}
export const incrementPersonalChatUsage = (uid: string) => updateUsage(uid, 'personalChatMessages');
export const incrementPersonChatUsage = (uid: string) => updateUsage(uid, 'personChatMessages');
export const incrementStatisticsAccess = (uid: string) => updateUsage(uid, 'statisticsAccess');
