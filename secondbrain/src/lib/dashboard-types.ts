export const feedbackStatuses = {
  open: "Pendiente",
  in_progress: "En revisión",
  resolved: "Resuelto",
  closed: "Cerrado",
} as const;
export const feedbackPriorities = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
} as const;
export const feedbackTypes = {
  suggestion: "Sugerencia",
  problem: "Error",
} as const;
export const usageLabels: Record<string, string> = {
  personalChatMessages: "Chat con el diario",
  personChatMessages: "Chat con personas",
  statisticsAccess: "Informes de IA",
};
export type FeedbackStatus = keyof typeof feedbackStatuses;
export type FeedbackPriority = keyof typeof feedbackPriorities;
export type FeedbackType = keyof typeof feedbackTypes;
export interface FeedbackReport {
  id: string;
  user_id: string;
  type: FeedbackType;
  message: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  admin_notes: string;
  email: string;
  display_name: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}
export interface DashboardUser {
  uid: string;
  email: string;
  display_name: string;
  admin: boolean;
  has_profile: boolean;
  created_at: string | null;
  last_login_at: string | null;
  email_confirmed: boolean;
  is_google_user: boolean;
  plan: string;
  effective_plan: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  entries: number;
  people: number;
  lastEntry: string | null;
  usage: Record<string, number>;
}
export interface DashboardUserDetail extends DashboardUser {
  transcriptions: number;
  analysedEntries: number;
  lastActivity: string | null;
  reportGeneratedAt: string | null;
  feedback: number;
  usageHistory: {
    month: string;
    feature: string;
    used: number;
    reserved: number;
  }[];
  billingEvents: {
    id: string;
    type: string;
    occurred_at: string;
    processed_at: string;
  }[];
}
export interface DashboardPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface DashboardOverview {
  users: number;
  admins: number;
  missingProfiles: number;
  newUsers30: number;
  activeUsers30: number;
  entries: number;
  people: number;
  transcriptions: number;
  analysedEntries: number;
  reports: number;
  plans: Record<string, number>;
  subscriptionStates: Record<string, number>;
  providerSubscriptions: number;
  cancellations: number;
  feedback: Partial<Record<FeedbackStatus, number>>;
  feedbackTypes: Partial<Record<FeedbackType, number>>;
  usage: Record<string, number>;
  pendingBillingEmails: number;
  failedBillingEmails: number;
  billingEvents30: number;
  catalog: {
    id: string;
    personal_chat_messages: number;
    person_chat_messages: number;
    statistics_access: number;
  }[];
  monthly: { month: string; users: number; entries: number }[];
  generatedAt: string;
  usageMonth: string;
  checkoutEnabled: boolean;
  billingEmailsEnabled: boolean;
}
