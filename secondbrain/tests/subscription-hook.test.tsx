// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useSubscription } from "@/hooks/useSubscription";
const mock = vi.hoisted(() => ({
  context: vi.fn(),
  fetch: vi.fn(),
  plan: vi.fn(),
  upgrade: vi.fn(),
  usage: vi.fn(),
  feature: vi.fn(),
  audio: vi.fn(),
  people: vi.fn(),
  personal: vi.fn(),
  person: vi.fn(),
  statistics: vi.fn(),
}));
vi.mock("@/contexts/SupabaseAuthContext", () => ({
  useSupabaseAuthContext: mock.context,
}));
vi.mock("@/lib/authenticated-fetch", () => ({
  authenticatedFetch: mock.fetch,
}));
vi.mock("@/lib/subscription-operations", () => ({
  getUserMonthlyUsage: mock.usage,
}));
vi.mock("@/middleware/subscription", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  getEffectivePlan: mock.plan,
  needsSubscriptionUpgrade: mock.upgrade,
  canUseFeature: mock.feature,
  canCreateTranscription: mock.audio,
  canManageMorePeople: mock.people,
  canSendPersonalChatMessage: mock.personal,
  canSendPersonChatMessage: mock.person,
  canAccessStatistics: mock.statistics,
}));
let identity: any;
const usage = {
  personalChatMessages: 2,
  personChatMessages: 3,
  statisticsAccess: 4,
  month: "2026-09",
};
beforeEach(() => {
  for (const fn of Object.values(mock)) fn.mockReset();
  identity = { user: { uid: "u" }, userProfile: { uid: "u" }, loading: false };
  mock.context.mockImplementation(() => identity);
  mock.fetch.mockResolvedValue(
    new Response('{"subscription":{"plan":"free"}}'),
  );
  mock.plan.mockResolvedValue("pro");
  mock.upgrade.mockResolvedValue(false);
  mock.usage.mockResolvedValue(usage);
  for (const fn of [
    mock.feature,
    mock.audio,
    mock.people,
    mock.personal,
    mock.person,
    mock.statistics,
  ])
    fn.mockResolvedValue(true);
});
it("loads effective plan and usage after authenticated status check", async () => {
  const { result } = renderHook(() => useSubscription());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current).toMatchObject({
    currentPlan: "pro",
    monthlyUsage: usage,
  });
  expect(mock.fetch).toHaveBeenCalledWith(
    "/api/subscription/status",
    expect.objectContaining({ body: '{"userId":"u"}' }),
  );
});
it("unauthenticated users have no paid plan or permissions", async () => {
  identity = { user: null, userProfile: null, loading: false };
  const { result } = renderHook(() => useSubscription());
  expect(result.current.currentPlan).toBe("free");
  expect(await result.current.checkCanUseFeature("hasStatistics")).toBe(false);
  expect(await result.current.checkCanSendPersonalChatMessage()).toBe(false);
  expect(mock.fetch).not.toHaveBeenCalled();
});
it("logout clears previous paid plan and usage", async () => {
  const { result, rerender } = renderHook(() => useSubscription());
  await waitFor(() => expect(result.current.currentPlan).toBe("pro"));
  identity = { user: null, userProfile: null, loading: false };
  rerender();
  expect(result.current).toMatchObject({
    currentPlan: "free",
    monthlyUsage: null,
    needsUpgrade: false,
  });
});
it("outdated requests cannot restore a paid plan after logout", async () => {
  let resolve!: Function;
  mock.plan.mockReturnValue(new Promise((r) => (resolve = r)));
  const { result, rerender } = renderHook(() => useSubscription());
  await waitFor(() => expect(mock.plan).toHaveBeenCalled());
  identity = { user: null, userProfile: null, loading: false };
  rerender();
  await act(async () => {
    resolve("elite");
  });
  expect(result.current).toMatchObject({
    currentPlan: "free",
    monthlyUsage: null,
  });
});
it("falls back safely when subscription loading fails", async () => {
  mock.plan.mockRejectedValue(new Error("offline"));
  const { result } = renderHook(() => useSubscription());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current).toMatchObject({
    currentPlan: "free",
    monthlyUsage: null,
    needsUpgrade: false,
  });
});
it("permission checks delegate with current owner and counters", async () => {
  const { result } = renderHook(() => useSubscription());
  await waitFor(() => expect(result.current.monthlyUsage).not.toBeNull());
  await result.current.checkCanUseFeature("hasStatistics");
  await result.current.checkCanCreateTranscription(10);
  await result.current.checkCanManageMorePeople(20);
  await result.current.checkCanSendPersonalChatMessage();
  await result.current.checkCanSendPersonChatMessage();
  await result.current.checkCanAccessStatistics();
  expect(mock.feature).toHaveBeenCalledWith("u", "hasStatistics");
  expect(mock.audio).toHaveBeenCalledWith("u", 10);
  expect(mock.people).toHaveBeenCalledWith("u", 20);
  expect(mock.personal).toHaveBeenCalledWith("u", 2);
  expect(mock.person).toHaveBeenCalledWith("u", 3);
  expect(mock.statistics).toHaveBeenCalledWith("u", 4);
});
it("refreshes monthly usage after a successful interaction", async () => {
  const { result } = renderHook(() => useSubscription());
  await waitFor(() => expect(result.current.loading).toBe(false));
  mock.usage.mockResolvedValue({ ...usage, personalChatMessages: 3 });
  await act(() => result.current.refreshMonthlyUsage());
  expect(result.current.monthlyUsage?.personalChatMessages).toBe(3);
});
