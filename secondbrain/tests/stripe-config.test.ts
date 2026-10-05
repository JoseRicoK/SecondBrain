import { expect, it, vi } from "vitest";
import {
  getStripeClient,
  isCheckoutEnabled,
  getBillingOrigin,
} from "@/lib/stripe-server";
const keys = [
  "STRIPE_SECRET_KEY",
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

it("billing return origin ignores request headers and defaults to canonical app", () => {
  vi.stubEnv("APP_BASE_URL", "");
  expect(getBillingOrigin()).toBe("https://app.secondbrainapp.com");
});
it.each([
  "http://attacker.invalid",
  "https://app.secondbrainapp.com/other",
  "https://user:password@app.secondbrainapp.com",
  "https://app.secondbrainapp.com?redirect=1",
])("rejects unsafe billing origin %s", (url) => {
  vi.stubEnv("APP_BASE_URL", url);
  expect(() => getBillingOrigin()).toThrow();
});
it("reuses Stripe SDK clients between server requests", () => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture");
  expect(getStripeClient()).toBe(getStripeClient());
});
