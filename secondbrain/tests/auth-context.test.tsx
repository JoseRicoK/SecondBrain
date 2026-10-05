// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import {
  SupabaseAuthProvider,
  useSupabaseAuthContext,
} from "@/contexts/SupabaseAuthContext";
const mock = vi.hoisted(() => ({
  listen: vi.fn(),
  unsubscribe: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
  signOutUser: vi.fn(),
  getProfile: vi.fn(),
  createProfile: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: mock.listen,
      getSession: mock.getSession,
      signOut: mock.signOut,
    },
  },
}));
vi.mock("@/lib/supabase-operations", () => ({ signOutUser: mock.signOutUser }));
vi.mock("@/lib/subscription-operations", () => ({
  getUserProfile: mock.getProfile,
  createUserProfile: mock.createProfile,
}));
const user = {
  id: "u",
  email: "ana@test.invalid",
  email_confirmed_at: "2026-01-01",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { display_name: "Ana" },
};
let notify: Function;
beforeEach(() => {
  for (const fn of Object.values(mock)) fn.mockReset();
  mock.signOut.mockResolvedValue({ error: null });
  mock.listen.mockImplementation((callback) => {
    notify = callback;
    return { data: { subscription: { unsubscribe: mock.unsubscribe } } };
  });
  mock.getProfile.mockResolvedValue({
    uid: "u",
    subscription: { plan: "free" },
  });
  mock.getSession.mockResolvedValue({
    data: { session: { access_token: "t" } },
  });
});
const mount = () =>
  renderHook(() => useSupabaseAuthContext(), { wrapper: SupabaseAuthProvider });
it("requires its provider", () => {
  expect(() => renderHook(() => useSupabaseAuthContext())).toThrow("Provider");
});
it("initializes anonymous state and unsubscribes on unmount", async () => {
  const { result, unmount } = mount();
  expect(result.current.loading).toBe(true);
  await act(() => notify("INITIAL_SESSION", null));
  expect(result.current).toMatchObject({
    user: null,
    userProfile: null,
    isGoogleUser: false,
    loading: false,
  });
  unmount();
  expect(mock.unsubscribe).toHaveBeenCalledOnce();
});
it("loads identity and profile without replacing the subscription", async () => {
  const { result } = mount();
  await act(() => notify("SIGNED_IN", { user }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current).toMatchObject({
    user: { uid: "u", displayName: "Ana" },
    userProfile: { uid: "u" },
    loading: false,
  });
  expect(mock.createProfile).toHaveBeenCalledWith(
    "u",
    { email: user.email, displayName: "Ana", isGoogleUser: false },
    true,
  );
  expect(await result.current.user?.getIdToken()).toBe("t");
});
it("linked Google providers have a consistent identity and flag", async () => {
  const { result } = mount();
  await act(() =>
    notify("SIGNED_IN", {
      user: {
        ...user,
        email_confirmed_at: null,
        app_metadata: { provider: "email", providers: ["email", "google"] },
      },
    }),
  );
  expect(result.current).toMatchObject({
    isGoogleUser: true,
    user: { providerData: [{ providerId: "google.com" }] },
  });
  expect(mock.signOut).not.toHaveBeenCalled();
});
it("rejects an unverified email user before loading a profile", async () => {
  const { result } = mount();
  await act(() =>
    notify("SIGNED_IN", { user: { ...user, email_confirmed_at: null } }),
  );
  await waitFor(() => expect(mock.signOut).toHaveBeenCalled());
  expect(mock.createProfile).not.toHaveBeenCalled();
  expect(result.current.user).toBeNull();
});
it("does not hang if profile loading fails", async () => {
  mock.createProfile.mockRejectedValue(new Error("offline"));
  const { result } = mount();
  await act(() => notify("SIGNED_IN", { user }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current).toMatchObject({
    user: { uid: "u" },
    userProfile: null,
    loading: false,
  });
});
it("signout clears account, profile and Google state even on failure", async () => {
  const { result } = mount();
  await act(() =>
    notify("SIGNED_IN", {
      user: { ...user, app_metadata: { provider: "google" } },
    }),
  );
  mock.signOutUser.mockRejectedValue(new Error("offline"));
  await act(async () => {
    await expect(result.current.signOut()).rejects.toThrow("offline");
  });
  expect(result.current).toMatchObject({
    user: null,
    userProfile: null,
    isGoogleUser: false,
    loading: false,
  });
});
it("refreshes the current profile", async () => {
  const { result } = mount();
  await act(() => notify("SIGNED_IN", { user }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  mock.getProfile.mockResolvedValue({
    uid: "u",
    subscription: { plan: "pro" },
  });
  await act(() => result.current.refreshUserProfile());
  await waitFor(() =>
    expect(result.current.userProfile?.subscription.plan).toBe("pro"),
  );
});
it("a profile response cannot restore another account after signout", async () => {
  let resolve!: Function;
  mock.getProfile.mockReturnValueOnce(new Promise((r) => (resolve = r)));
  const { result } = mount();
  let pending!: Promise<void>;
  await act(async () => {
    pending = notify("SIGNED_IN", { user });
  });
  await waitFor(() => expect(mock.getProfile).toHaveBeenCalled());
  await act(() => result.current.signOut());
  await act(async () => {
    resolve({ uid: "u" });
    await pending;
  });
  expect(result.current).toMatchObject({
    user: null,
    userProfile: null,
    isGoogleUser: false,
  });
});

it("returns synchronously before starting profile queries under the auth lock", async () => {
  const { result } = mount();
  act(() => {
    expect(notify("TOKEN_REFRESHED", { user })).toBeUndefined();
    expect(mock.getProfile).not.toHaveBeenCalled();
  });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.userProfile).toMatchObject({ uid: "u" });
});
it("cancels deferred profile work when unmounted", async () => {
  const { unmount } = mount();
  act(() => notify("SIGNED_IN", { user }));
  unmount();
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(mock.getProfile).not.toHaveBeenCalled();
});
