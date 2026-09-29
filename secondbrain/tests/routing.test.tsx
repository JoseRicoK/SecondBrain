// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import Login from "@/app/login/page";
import Signup from "@/app/signup/page";
import Dashboard from "@/app/dashboard/page";
const mock = vi.hoisted(() => ({
  context: vi.fn(),
  fetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  params: new URLSearchParams(),
}));
const router = { push: mock.push };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => mock.params,
}));
vi.mock("@/contexts/SupabaseAuthContext", () => ({
  useSupabaseAuthContext: mock.context,
}));
vi.mock("@/lib/authenticated-fetch", () => ({
  authenticatedFetch: mock.fetch,
}));
vi.mock("@/components/Auth", () => ({
  default: ({ onAuthSuccess }: any) => (
    <button
      onClick={() =>
        onAuthSuccess({ uid: "u" }, mock.params.get("plan") || undefined)
      }
    >
      Fixture login
    </button>
  ),
}));
beforeEach(() => {
  mock.push.mockReset();
  mock.context.mockReset().mockReturnValue({
    user: null,
    userProfile: null,
    loading: false,
    refreshUserProfile: mock.refresh,
  });
  mock.fetch
    .mockReset()
    .mockImplementation(
      async () => new Response('{"subscription":{"plan":"free"}}'),
    );
  mock.refresh.mockReset().mockResolvedValue();
  mock.params = new URLSearchParams();
});
it.each([Login, Signup])(
  "authenticated login/signup redirects to the diary",
  async (Page) => {
    mock.context.mockReturnValue({ user: { uid: "u" }, loading: false });
    render(<Page />);
    await waitFor(() => expect(mock.push).toHaveBeenCalledWith("/"));
  },
);
it("login without a selected plan opens the diary", async () => {
  render(<Login />);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Fixture login" }));
  expect(mock.push).toHaveBeenCalledWith("/");
});
it.each(["pro", "elite"])(
  "login keeps requested %s plan after identity verification",
  async (plan) => {
    mock.params = new URLSearchParams({ plan });
    render(<Login />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Fixture login" }));
    expect(mock.push).toHaveBeenCalledWith(`/subscription?plan=${plan}`);
    expect(JSON.parse(mock.fetch.mock.calls[0][1].body)).toEqual({
      userId: "u",
    });
  },
);
it("login does not send an existing paid user to buy the same plan", async () => {
  mock.params = new URLSearchParams({ plan: "pro" });
  mock.fetch.mockImplementation(
    async () => new Response('{"subscription":{"plan":"pro"}}'),
  );
  render(<Login />);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Fixture login" }));
  expect(mock.push).toHaveBeenCalledWith("/");
});
it("signup with selected paid plan uses subscription page on status failure", async () => {
  mock.params = new URLSearchParams({ plan: "elite" });
  mock.fetch.mockRejectedValue(new Error("offline"));
  render(<Signup />);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Fixture login" }));
  expect(mock.push).toHaveBeenCalledWith("/subscription?plan=elite");
});
it("anonymous dashboard redirects to login", async () => {
  render(<Dashboard />);
  expect(mock.push).toHaveBeenCalledWith("/login");
  expect(mock.fetch).not.toHaveBeenCalled();
});
it("dashboard without checkout session returns to the diary", async () => {
  mock.context.mockReturnValue({ user: { uid: "u" }, loading: false });
  render(<Dashboard />);
  expect(mock.push).toHaveBeenCalledWith("/");
});
it("dashboard verifies payment before showing success or refreshing profile", async () => {
  mock.context.mockReturnValue({
    user: { uid: "u" },
    loading: false,
    refreshUserProfile: mock.refresh,
  });
  mock.params = new URLSearchParams({ session_id: "cs_fixture" });
  mock.fetch.mockImplementation(async () => new Response('{"plan":"pro"}'));
  render(<Dashboard />);
  expect(await screen.findByText("¡Pago exitoso!")).toBeVisible();
  expect(mock.fetch).toHaveBeenCalledWith(
    "/api/stripe/verify-payment",
    expect.objectContaining({
      body: '{"sessionId":"cs_fixture","userId":"u"}',
    }),
  );
  expect(mock.refresh).toHaveBeenCalled();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Ir al diario" }));
  expect(mock.push).toHaveBeenCalledWith("/");
});
it("dashboard payment failure cannot appear as success", async () => {
  mock.context.mockReturnValue({
    user: { uid: "u" },
    loading: false,
    refreshUserProfile: mock.refresh,
  });
  mock.params = new URLSearchParams({ session_id: "cs_fixture" });
  mock.fetch.mockImplementation(
    async () => new Response('{"error":"Stripe unavailable"}', { status: 503 }),
  );
  render(<Dashboard />);
  expect(await screen.findByText("Error en el pago")).toBeVisible();
  expect(mock.refresh).not.toHaveBeenCalled();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Intentar de nuevo" }));
  expect(mock.push).toHaveBeenCalledWith("/subscription");
});
