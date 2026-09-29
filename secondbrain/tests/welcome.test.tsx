// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import WelcomeManager from "@/components/WelcomeManager";
const mock = vi.hoisted(() => ({
  context: vi.fn(),
  complete: vi.fn(),
  seen: vi.fn(),
  params: new URLSearchParams(),
}));
vi.mock("@/contexts/SupabaseAuthContext", () => ({
  useSupabaseAuthContext: mock.context,
}));
vi.mock("@/lib/subscription-operations", () => ({
  markWelcomeComplete: mock.complete,
  markWelcomeModalSeen: mock.seen,
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => mock.params }));
beforeEach(() => {
  mock.context.mockReturnValue({
    user: { uid: "u", displayName: "Ana" },
    userProfile: {
      displayName: "Ana",
      subscription: { plan: "pro" },
      showWelcomeModal: true,
    },
    loading: false,
  });
  mock.complete.mockReset().mockResolvedValue();
  mock.seen.mockReset().mockResolvedValue();
  mock.params = new URLSearchParams({ session_id: "cs_fixture" });
  vi.useFakeTimers();
});
it("does not show premium welcome without a checkout session", () => {
  mock.params = new URLSearchParams();
  render(<WelcomeManager />);
  expect(screen.queryByText(/Bienvenido a SecondBrain Premium/)).toBeNull();
});
it("shows paid welcome and marks it as seen on close", async () => {
  render(<WelcomeManager />);
  await act(() => {
    vi.advanceTimersByTime(500);
  });
  expect(screen.getByText(/Bienvenido a SecondBrain Premium/)).toBeVisible();
  await act(async () => {
    fireEvent.click(screen.getByTitle("Cerrar modal de bienvenida"));
  });
  await act(() => {
    vi.advanceTimersByTime(300);
  });
  expect(mock.complete).toHaveBeenCalledWith("u");
  expect(mock.seen).toHaveBeenCalledWith("u");
  expect(screen.queryByText(/Bienvenido a SecondBrain Premium/)).toBeNull();
});
it("can close even when saving welcome completion fails", async () => {
  mock.complete.mockRejectedValue(new Error("offline"));
  render(<WelcomeManager />);
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: /Comenzar mi experiencia/ }),
    );
  });
  await act(() => {
    vi.advanceTimersByTime(300);
  });
  expect(screen.queryByText(/Bienvenido a SecondBrain Premium/)).toBeNull();
});
