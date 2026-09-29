import { expect, it, vi } from "vitest";
import { getStripeClient, isCheckoutEnabled } from "@/lib/stripe-server";
const keys = [
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_PRO_PRICE_ID",
  "STRIPE_ELITE_PRICE_ID",
  "STRIPE_WEBHOOK_SECRET",
];
it("checkout defaults off and missing secret creates no client", () => {
  vi.stubEnv("STRIPE_CHECKOUT_ENABLED", "");
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  expect(isCheckoutEnabled()).toBe(false);
  expect(getStripeClient()).toBeNull();
});
it.each(keys)("checkout requires %s even when enabled", (key) => {
  for (const name of keys) vi.stubEnv(name, "fixture");
  vi.stubEnv("STRIPE_CHECKOUT_ENABLED", "true");
  vi.stubEnv(key, "");
  expect(isCheckoutEnabled()).toBe(false);
});
it("checkout requires explicit flag and all credentials", () => {
  for (const name of keys) vi.stubEnv(name, "fixture");
  vi.stubEnv("STRIPE_CHECKOUT_ENABLED", "false");
  expect(isCheckoutEnabled()).toBe(false);
  vi.stubEnv("STRIPE_CHECKOUT_ENABLED", "true");
  expect(isCheckoutEnabled()).toBe(true);
  expect(getStripeClient()).not.toBeNull();
});
