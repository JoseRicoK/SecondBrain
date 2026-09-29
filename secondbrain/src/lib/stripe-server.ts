import Stripe from 'stripe';

export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return new Stripe(secretKey, { apiVersion: '2024-06-20' as Stripe.LatestApiVersion });
}

export function isCheckoutEnabled(): boolean {
  return process.env.STRIPE_CHECKOUT_ENABLED === 'true' &&
    Boolean(process.env.STRIPE_SECRET_KEY) &&
    Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) &&
    Boolean(process.env.STRIPE_PRO_PRICE_ID) &&
    Boolean(process.env.STRIPE_ELITE_PRICE_ID) &&
    Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}
