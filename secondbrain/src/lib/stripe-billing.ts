import type Stripe from "stripe";
import { getDatabaseClient } from "./supabase";
import {
  findUserByStripeCustomerId,
  type UserSubscription,
} from "./subscription-operations";
export function stripeObjectId(
  value: string | { id: string } | null,
): string | null {
  return typeof value === "string" ? value : value?.id || null;
}
export function stripePeriodEnd(subscription: Stripe.Subscription): Date {
  const periods = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!periods.length)
    throw new Error("Stripe subscription has no valid period");
  return new Date(Math.min(...periods) * 1000);
}
export function stripeSubscriptionData(
  subscription: Stripe.Subscription,
): Partial<UserSubscription> {
  const item = subscription.items.data;
  if (item.length !== 1) throw new Error("Unsupported subscription items");
  const price = item[0].price.id;
  const plan =
    price === process.env.STRIPE_PRO_PRICE_ID
      ? "pro"
      : price === process.env.STRIPE_ELITE_PRICE_ID
        ? "elite"
        : null;
  if (!plan) throw new Error("Unknown subscription price");
  const invoice = subscription.latest_invoice;
  const paid =
    typeof invoice === "object" &&
    invoice !== null &&
    invoice.status === "paid";
  const status: UserSubscription["status"] =
    subscription.status === "active" && paid
      ? "active"
      : subscription.status === "past_due"
        ? "past_due"
        : ["canceled", "unpaid"].includes(subscription.status)
          ? "canceled"
          : "inactive";
  return {
    plan: status === "canceled" ? "free" : plan,
    status,
    stripeCustomerId: stripeObjectId(subscription.customer) || undefined,
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd: stripePeriodEnd(subscription),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}
export async function syncStripeSubscription(
  subscription: Stripe.Subscription,
  event: { id: string; type: string; created: number },
  expectedOwner?: string,
  stripe?: Stripe,
) {
  const customerId = stripeObjectId(subscription.customer);
  if (!customerId) throw new Error("Missing customer");
  const owner = await findUserByStripeCustomerId(customerId);
  if (!owner && stripe) {
    const customer = await stripe.customers.retrieve(customerId);
    // Account deletion has already closed Stripe billing; acknowledge subsequent deletion events.
    if (customer.deleted)
      return { owner: null, snapshot: null, applied: false };
  }
  if (
    !owner ||
    (expectedOwner && owner !== expectedOwner) ||
    (subscription.metadata.uid && subscription.metadata.uid !== owner)
  )
    throw new Error("Subscription owner mismatch");
  const snapshot = stripeSubscriptionData(subscription);
  const { data, error } = await getDatabaseClient().rpc("apply_billing_event", {
    p_id: event.id,
    p_user_id: owner,
    p_type: event.type,
    p_occurred_at: new Date(event.created * 1000).toISOString(),
    p_subscription: snapshot,
  });
  if (error) throw error;
  return { owner, snapshot, applied: data !== false };
}

export async function verifyStripePrice(
  stripe: Stripe,
  plan: "pro" | "elite",
  priceId: string,
) {
  const price = await stripe.prices.retrieve(priceId);
  const amount = plan === "pro" ? 999 : 1999;
  if (
    !price.active ||
    price.currency !== "eur" ||
    price.unit_amount !== amount ||
    price.recurring?.interval !== "month" ||
    price.recurring.interval_count !== 1
  )
    throw new Error(
      "El precio de Stripe no coincide con las condiciones del plan",
    );
}
