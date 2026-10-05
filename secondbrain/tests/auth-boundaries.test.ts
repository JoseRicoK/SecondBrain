import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const auth = vi.hoisted(() => ({ getUser: vi.fn(), getSession: vi.fn(), refreshSession: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth } }));
import { getAuthenticatedUser, getRequestUser } from "@/lib/api-auth";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
beforeEach(() => {
  auth.getUser.mockReset();
  auth.getSession.mockReset();
  auth.refreshSession.mockReset();
});
it("requires a token and validates it through Supabase", async () => {
  expect(await getAuthenticatedUser()).toBeNull();
  expect(auth.getUser).not.toHaveBeenCalled();
  auth.getUser.mockResolvedValue({
    data: { user: { id: "u", email: "u@test.invalid" } },
    error: null,
  });
  expect(await getAuthenticatedUser("token")).toEqual({
    uid: "u",
    email: "u@test.invalid",
  });
  expect(auth.getUser).toHaveBeenCalledWith("token");
});
it.each([
  { data: { user: null }, error: null },
  { data: { user: { id: "u" } }, error: { message: "expired" } },
])("rejects invalid or expired tokens", async (result) => {
  auth.getUser.mockResolvedValue(result);
  expect(await getAuthenticatedUser("bad")).toBeNull();
});
it.each(["", "Basic xyz", "Bearer", "token"])(
  "rejects malformed authorization %s",
  async (value) => {
    expect(
      await getRequestUser(
        new NextRequest("http://localhost", {
          headers: { authorization: value },
        }),
      ),
    ).toBeNull();
    expect(auth.getUser).not.toHaveBeenCalled();
  },
);
it("accepts case-insensitive Bearer scheme", async () => {
  auth.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
  expect(
    await getRequestUser(
      new NextRequest("http://localhost", {
        headers: { authorization: "bearer token" },
      }),
    ),
  ).toMatchObject({ uid: "u" });
});
it.each([null, { access_token: "" }])(
  "does not fetch without an active session",
  async (session) => {
    auth.getSession.mockResolvedValue({ data: { session }, error: null });
    await expect(authenticatedFetch("/api/private")).rejects.toThrow(
      "iniciar sesión",
    );
    expect(fetch).not.toHaveBeenCalled();
  },
);
it("does not fetch when reading the session fails", async () => {
  auth.getSession.mockResolvedValue({
    data: { session: { access_token: "t" } },
    error: new Error("offline"),
  });
  await expect(authenticatedFetch("/api/private")).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
it("replaces forged authorization while preserving request options", async () => {
  auth.getSession.mockResolvedValue({
    data: { session: { access_token: "real" } },
    error: null,
  });
  const response = new Response("{}");
  vi.mocked(fetch).mockResolvedValue(response);
  expect(
    await authenticatedFetch("/api/private", {
      method: "POST",
      headers: { Authorization: "forged", "X-Custom": "yes" },
      body: "{}",
    }),
  ).toBe(response);
  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(url).toBe("/api/private");
  expect(init).toMatchObject({ method: "POST", body: "{}" });
  expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer real");
  expect(new Headers(init?.headers).get("X-Custom")).toBe("yes");
});

it("refreshes a rejected session and retries once under the same account", async () => {
  auth.getSession.mockResolvedValue({ data: { session: { access_token: "old", user: { id: "u" } } } });
  auth.refreshSession.mockResolvedValue({ data: { session: { access_token: "new", user: { id: "u" } } }, error: null });
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(new Response("{}"));
  const response = await authenticatedFetch("/api/subscription/status", { method: "POST", body: "{}" });
  expect(response.ok).toBe(true);
  expect(auth.refreshSession).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(new Headers(vi.mocked(fetch).mock.calls[1][1]?.headers).get("Authorization")).toBe("Bearer new");
});
it.each(["failed", "switched", "still rejected"])("does not bypass an invalid session: %s", async mode => {
  auth.getSession.mockResolvedValue({ data: { session: { access_token: "old", user: { id: "u" } } } });
  auth.refreshSession.mockResolvedValue({ data: { session: mode === "failed" ? null : { access_token: "new", user: { id: mode === "switched" ? "other" : "u" } } }, error: mode === "failed" ? new Error("revoked") : null });
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
  expect((await authenticatedFetch("/api/private")).status).toBe(401);
  expect(fetch).toHaveBeenCalledTimes(mode === "still rejected" ? 2 : 1);
  expect(auth.refreshSession).toHaveBeenCalledOnce();
});
it.each([403, 429])("does not refresh or bypass plan/quota rejection %s", async status => {
  auth.getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status }));
  expect((await authenticatedFetch("/api/private")).status).toBe(status);
  expect(auth.refreshSession).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledOnce();
});
