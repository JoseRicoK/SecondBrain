import { it, expect } from "vitest";
import { validatedBillingUrl } from "@/lib/billing-navigation";
it.each([
  "http://checkout.stripe.com/pay/1",
  "https://checkout.stripe.com.attacker.invalid/pay/1",
  "https://user@checkout.stripe.com/pay/1",
  "javascript:alert(1)",
  null,
  "https://checkout.stripe.com:8443/pay/1",
  "https://billing.stripe.com/session",
])("rejects unsafe checkout destination %s", (value) =>
  expect(() => validatedBillingUrl(value, "checkout")).toThrow(),
);
it("accepts hosted checkout and portal URLs from the correct origins", () => {
  expect(
    validatedBillingUrl(
      "https://checkout.stripe.com/c/pay/fixture",
      "checkout",
    ),
  ).toContain("https://checkout.stripe.com/");
  expect(
    validatedBillingUrl(
      "https://billing.stripe.com/p/session/fixture",
      "portal",
    ),
  ).toContain("https://billing.stripe.com/");
});
