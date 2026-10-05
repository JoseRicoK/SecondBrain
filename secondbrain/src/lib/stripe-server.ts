import Stripe from "stripe";
export const STRIPE_API_VERSION = "2026-08-26.dahlia" as const;
let cached: { key: string; client: Stripe } | undefined;
export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (cached?.key !== key)
    cached = {
      key,
      client: new Stripe(key, {
        apiVersion: STRIPE_API_VERSION,
        maxNetworkRetries: 2,
        timeout: 20000,
      }),
    };
  return cached.client;
}
export function isCheckoutEnabled(): boolean {
  return (
    process.env.STRIPE_CHECKOUT_ENABLED === "true" &&
    [
      "STRIPE_SECRET_KEY",
      "STRIPE_PRO_PRICE_ID",
      "STRIPE_ELITE_PRICE_ID",
      "STRIPE_WEBHOOK_SECRET",
    ].every((key) => Boolean(process.env[key]))
  );
}
export function getBillingOrigin(): string {
  const url = new URL(
    process.env.APP_BASE_URL || "https://app.secondbrainapp.com",
  );
  const local =
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    process.env.NODE_ENV !== "production";
  if (
    (url.protocol !== "https:" && !local) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("APP_BASE_URL must be a trusted HTTPS origin");
  return url.origin;
}
