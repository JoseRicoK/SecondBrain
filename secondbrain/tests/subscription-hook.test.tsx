// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useSubscription } from "@/hooks/useSubscription";
import { clearSubscriptionState } from "@/lib/subscription-state";
import { PLAN_LIMITS } from "@/middleware/subscription";
const mock = vi.hoisted(() => ({ context: vi.fn(), fetch: vi.fn() }));
vi.mock("@/contexts/SupabaseAuthContext", () => ({
  useSupabaseAuthContext: mock.context,
}));
vi.mock("@/lib/authenticated-fetch", () => ({
  authenticatedFetch: mock.fetch,
}));
let identity: any;
const snapshot = (overrides = {}) => ({
  currentPlan: "pro",
  planLimits: PLAN_LIMITS.pro,
  monthlyUsage: {
    personalChatMessages: 2,
    personChatMessages: 3,
    statisticsAccess: 4,
    month: "2026-09",
    lastUpdated: "2026-09-29T12:00:00Z",
  },
  subscription: {
    plan: "pro",
    status: "active",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
  needsUpgrade: false,
  resetAt: "2026-10-01T00:00:00Z",
  ...overrides,
});
beforeEach(() => {
  clearSubscriptionState();
  mock.fetch.mockReset();
  identity = { user: { uid: "u" }, userProfile: { uid: "u" }, loading: false };
  mock.context.mockImplementation(() => identity);
  mock.fetch.mockImplementation(async () => Response.json(snapshot()));
});
it("loads one authenticated server snapshot, including reset and limits", async () => {
  const { result } = renderHook(useSubscription);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.currentPlan).toBe("pro");
  expect(result.current.monthlyUsage?.personalChatMessages).toBe(2);
  expect(result.current.resetAt).toBe("2026-10-01T00:00:00Z");
  expect(mock.fetch).toHaveBeenCalledTimes(1);
});
it("deduplicates requests across components and shares refreshed counters", async () => {
  const a = renderHook(useSubscription);
  const b = renderHook(useSubscription);
  await waitFor(() => expect(a.result.current.loading).toBe(false));
  expect(mock.fetch).toHaveBeenCalledTimes(1);
  mock.fetch.mockImplementation(async () =>
    Response.json(
      snapshot({
        monthlyUsage: { ...snapshot().monthlyUsage, personalChatMessages: 3 },
      }),
    ),
  );
  await act(() => a.result.current.refreshMonthlyUsage());
  expect(b.result.current.monthlyUsage?.personalChatMessages).toBe(3);
});
it("unauthenticated users have no paid plan or permissions", async () => {
  identity = { user: null, userProfile: null, loading: false };
  const { result } = renderHook(useSubscription);
  expect(result.current.currentPlan).toBe("free");
  expect(await result.current.checkCanUseFeature("hasStatistics")).toBe(false);
  expect(await result.current.checkCanSendPersonalChatMessage()).toBe(false);
  expect(mock.fetch).not.toHaveBeenCalled();
});
it("logout clears plan and obsolete requests cannot restore it", async () => {
  let resolve!: Function;
  mock.fetch.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const { result, rerender } = renderHook(useSubscription);
  identity = { user: null, userProfile: null, loading: false };
  rerender();
  await act(async () => resolve(Response.json(snapshot())));
  expect(result.current.currentPlan).toBe("free");
  expect(result.current.monthlyUsage).toBeNull();
});
it("account switches immediately hide previous usage and ignore old responses", async () => {
  let resolve!: Function;
  mock.fetch.mockReturnValueOnce(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const { result, rerender } = renderHook(useSubscription);
  identity = {
    user: { uid: "other" },
    userProfile: { uid: "other" },
    loading: false,
  };
  rerender();
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () =>
    resolve(Response.json(snapshot({ currentPlan: "elite" }))),
  );
  expect(result.current.currentPlan).toBe("pro");
});
it.each([503, 200])(
  "fails closed on unavailable or incomplete status (%s)",
  async (status) => {
    mock.fetch.mockResolvedValue(new Response("{}", { status }));
    const { result } = renderHook(useSubscription);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.monthlyUsage).toBeNull();
    expect(result.current.error).toBeTruthy();
    expect(await result.current.checkCanSendPersonalChatMessage()).toBe(false);
  },
);
it("permission checks use the returned policy and counters without database calls", async () => {
  const { result } = renderHook(useSubscription);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(await result.current.checkCanUseFeature("hasStatistics")).toBe(true);
  expect(await result.current.checkCanCreateTranscription(100)).toBe(true);
  expect(await result.current.checkCanManageMorePeople(100)).toBe(true);
  expect(await result.current.checkCanSendPersonalChatMessage()).toBe(true);
  expect(await result.current.checkCanSendPersonChatMessage()).toBe(true);
  expect(await result.current.checkCanAccessStatistics()).toBe(true);
  expect(mock.fetch).toHaveBeenCalledTimes(1);
});
it("successful actions refresh all subscribers through the shared event", async () => {
  const { result } = renderHook(useSubscription);
  await waitFor(() => expect(result.current.loading).toBe(false));
  mock.fetch.mockImplementation(async () =>
    Response.json(
      snapshot({ currentPlan: "elite", planLimits: PLAN_LIMITS.elite }),
    ),
  );
  await act(async () =>
    window.dispatchEvent(new Event("subscription-updated")),
  );
  await waitFor(() => expect(result.current.currentPlan).toBe("elite"));
});
it("an action during an in-flight refresh queues one newer snapshot", async () => {
  const { result } = renderHook(useSubscription);
  await waitFor(() => expect(result.current.loading).toBe(false));
  let resolve!: (response: Response) => void;
  mock.fetch.mockReturnValueOnce(
    new Promise<Response>((r) => {
      resolve = r;
    }),
  );
  const old = result.current.refreshMonthlyUsage();
  act(() => {
    window.dispatchEvent(new Event("subscription-updated"));
  });
  mock.fetch.mockImplementation(async () =>
    Response.json(
      snapshot({
        monthlyUsage: { ...snapshot().monthlyUsage, personalChatMessages: 4 },
      }),
    ),
  );
  await act(async () => {
    resolve(Response.json(snapshot()));
    await old;
  });
  expect(result.current.monthlyUsage?.personalChatMessages).toBe(4);
});
