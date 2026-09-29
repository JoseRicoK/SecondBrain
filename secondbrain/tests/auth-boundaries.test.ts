import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const auth = vi.hoisted(() => ({ getUser: vi.fn(), getSession: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth } }));
import { getAuthenticatedUser, getRequestUser } from "@/lib/api-auth";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
beforeEach(() => {
  auth.getUser.mockReset();
  auth.getSession.mockReset();
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
