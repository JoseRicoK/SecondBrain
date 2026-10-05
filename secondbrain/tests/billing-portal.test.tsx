// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({ fetch: vi.fn(), navigate: vi.fn() }));
vi.mock("@/lib/authenticated-fetch", () => ({
  authenticatedFetch: mock.fetch,
}));
vi.mock("@/lib/billing-navigation", () => ({
  navigateToBilling: mock.navigate,
}));
import BillingPortalButton from "@/components/BillingPortalButton";
it("portal sends no user-controlled customer and redirects to returned trusted portal", async () => {
  mock.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({ url: "https://billing.stripe.com/p/session/fixture" }),
    ),
  );
  render(<BillingPortalButton userId="u" />);
  await userEvent.setup().click(screen.getByRole("button"));
  expect(mock.fetch).toHaveBeenCalledWith("/api/stripe/create-portal-session", {
    method: "POST",
  });
  expect(mock.navigate).toHaveBeenCalledWith(
    "https://billing.stripe.com/p/session/fixture",
    "portal",
  );
});
it("failed portal request stays visible without redirect", async () => {
  mock.fetch.mockResolvedValue(
    new Response(JSON.stringify({ error: "No disponible" }), { status: 503 }),
  );
  render(<BillingPortalButton userId="u" />);
  await userEvent.setup().click(screen.getByRole("button"));
  expect(await screen.findByRole("alert")).toHaveTextContent("No disponible");
  expect(mock.navigate).not.toHaveBeenCalled();
});
it("obsolete account portal response never redirects the next account", async () => {
  let finish: (value: Response) => void = () => {};
  mock.fetch.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<BillingPortalButton userId="u" />);
  await userEvent.setup().click(screen.getByRole("button"));
  view.rerender(<BillingPortalButton userId="other" />);
  finish(
    new Response(
      JSON.stringify({ url: "https://billing.stripe.com/p/session/old" }),
    ),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mock.navigate).not.toHaveBeenCalled();
});
