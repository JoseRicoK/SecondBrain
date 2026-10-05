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
vi.mock("@/lib/billing-navigation", () => ({
  navigateToBilling: mock.redirect,
}));
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
  mock.fetch.mockResolvedValue(
    new Response('{"checkoutUrl":"https://checkout.stripe.com/c/pay/cs_test"}'),
  );
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
  expect(mock.redirect).toHaveBeenCalledWith(
    "https://checkout.stripe.com/c/pay/cs_test",
    "checkout",
  );
  expect(JSON.parse(mock.fetch.mock.calls[0][1].body)).toEqual({
    requestId: expect.any(String),
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
it("hosted checkout works without loading a browser Stripe SDK or publishable key", async () => {
  vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "");
  const Component = (await import("@/components/CheckoutForm")).default;
  render(
    <Component plan={plan} userId="u" userEmail="u@test.invalid" enabled />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Suscribirse a Pro" }));
  expect(mock.redirect).toHaveBeenCalledWith(
    "https://checkout.stripe.com/c/pay/cs_test",
    "checkout",
  );
  expect(mock.load).not.toHaveBeenCalled();
});

it("a failed checkout retry reuses the same attempt to avoid duplicate sessions", async () => {
  mock.fetch.mockRejectedValueOnce(new Error("Error de red"));
  const Component = (await import("@/components/CheckoutForm")).default;
  render(
    <Component plan={plan} userId="u" userEmail="u@test.invalid" enabled />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Suscribirse a Pro" }));
  expect(await screen.findByText("Error de red")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Suscribirse a Pro" }));
  const bodies = mock.fetch.mock.calls.map((call) => JSON.parse(call[1].body));
  expect(bodies[0].requestId).toBe(bodies[1].requestId);
  expect(mock.redirect).toHaveBeenCalledWith(
    "https://checkout.stripe.com/c/pay/cs_test",
    "checkout",
  );
});

it("obsolete account checkout response never opens another account's payment session", async () => {
  let finish: (value: Response) => void = () => {};
  mock.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const Component = (await import("@/components/CheckoutForm")).default;
  const view = render(
    <Component plan={plan} userId="u" userEmail="u@test.invalid" enabled />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Suscribirse a Pro" }));
  view.rerender(
    <Component
      plan={plan}
      userId="other"
      userEmail="other@test.invalid"
      enabled
    />,
  );
  finish(
    new Response(
      JSON.stringify({ checkoutUrl: "https://checkout.stripe.com/c/pay/old" }),
    ),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mock.redirect).not.toHaveBeenCalled();
});
it("pending attempt can be canceled explicitly and the next retry has a new UUID", async () => {
  mock.fetch
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "Intento pendiente",
          code: "CHECKOUT_PENDING",
        }),
        { status: 409 },
      ),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: true })))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          checkoutUrl: "https://checkout.stripe.com/c/pay/new",
        }),
      ),
    );
  const Component = (await import("@/components/CheckoutForm")).default;
  render(
    <Component plan={plan} userId="u" userEmail="u@test.invalid" enabled />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Suscribirse a Pro" }));
  await user.click(
    screen.getByRole("button", { name: "Cancelar intento de pago pendiente" }),
  );
  await user.click(screen.getByRole("button", { name: "Suscribirse a Pro" }));
  expect(mock.fetch.mock.calls[1][0]).toBe(
    "/api/stripe/cancel-checkout-session",
  );
  expect(JSON.parse(mock.fetch.mock.calls[0][1].body).requestId).not.toBe(
    JSON.parse(mock.fetch.mock.calls[2][1].body).requestId,
  );
  expect(mock.redirect).toHaveBeenCalledWith(
    "https://checkout.stripe.com/c/pay/new",
    "checkout",
  );
});
