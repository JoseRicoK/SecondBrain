// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  fetch: vi.fn(),
  redirect: vi.fn(),
  load: vi.fn(),
}));
vi.mock("@/lib/authenticated-fetch", () => ({
  authenticatedFetch: mock.fetch,
}));
vi.mock("@stripe/stripe-js", () => ({ loadStripe: mock.load }));
const plan = {
  name: "Pro",
  price: 9.99,
  priceId: "price_test",
  description: "Plan de prueba",
  icon: () => null,
  color: "",
  features: [],
};
beforeEach(() => {
  vi.resetModules();
  mock.load.mockResolvedValue({ redirectToCheckout: mock.redirect });
  mock.redirect.mockResolvedValue({});
  mock.fetch.mockResolvedValue(new Response('{"sessionId":"cs_test"}'));
  vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_fixture");
});
it("disabled checkout is visible but cannot call Stripe", async () => {
  const Component = (await import("@/components/CheckoutForm")).default;
  render(
    <Component
      plan={plan}
      userId="u"
      userEmail="u@test.invalid"
      enabled={false}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Pagos disponibles próximamente" }),
  ).toBeDisabled();
  expect(mock.fetch).not.toHaveBeenCalled();
});
it("enabled checkout sends plan and redirects to returned session", async () => {
  const Component = (await import("@/components/CheckoutForm")).default;
  render(
    <Component plan={plan} userId="u" userEmail="u@test.invalid" enabled />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Suscribirse a Pro" }));
  expect(mock.redirect).toHaveBeenCalledWith({ sessionId: "cs_test" });
  expect(JSON.parse(mock.fetch.mock.calls[0][1].body)).toEqual({
    planType: "pro",
    userId: "u",
    userEmail: "u@test.invalid",
  });
});
it("API errors stay visible and never redirect", async () => {
  mock.fetch.mockResolvedValue(
    new Response('{"error":"Pagos no disponibles"}', { status: 503 }),
  );
  const Component = (await import("@/components/CheckoutForm")).default;
  render(
    <Component plan={plan} userId="u" userEmail="u@test.invalid" enabled />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Suscribirse a Pro" }));
  expect(await screen.findByText("Pagos no disponibles")).toBeVisible();
  expect(mock.redirect).not.toHaveBeenCalled();
});
it("missing publishable key keeps checkout off", async () => {
  vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "");
  const Component = (await import("@/components/CheckoutForm")).default;
  render(
    <Component plan={plan} userId="u" userEmail="u@test.invalid" enabled />,
  );
  expect(
    screen.getByRole("button", { name: "Pagos disponibles próximamente" }),
  ).toBeDisabled();
  expect(mock.load).not.toHaveBeenCalled();
});
