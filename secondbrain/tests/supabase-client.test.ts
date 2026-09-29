import { beforeEach, expect, it, vi } from "vitest";
const createClient = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient }));
beforeEach(() => {
  vi.resetModules();
  createClient.mockReset().mockReturnValue({ fixture: true });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixtures.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-fixture");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-fixture");
});
it.each(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"])(
  "missing %s fails clearly before creating a client",
  async (key) => {
    vi.stubEnv(key, "");
    await expect(import("@/lib/supabase")).rejects.toThrow("obligatorias");
    expect(createClient).not.toHaveBeenCalled();
  },
);
it("server database calls use service role without session persistence", async () => {
  const { getDatabaseClient } = await import("@/lib/supabase");
  getDatabaseClient();
  expect(createClient).toHaveBeenLastCalledWith(
    "https://fixtures.supabase.co",
    "service-fixture",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
});
it("server operations fail rather than falling back to anon credentials", async () => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  const { getDatabaseClient } = await import("@/lib/supabase");
  expect(() => getDatabaseClient()).toThrow("SERVICE_ROLE_KEY");
  expect(createClient).toHaveBeenCalledTimes(1);
});
it("browser operations reuse the anon singleton and never expose service role", async () => {
  vi.stubGlobal("window", {});
  const { supabase, getDatabaseClient } = await import("@/lib/supabase");
  expect(getDatabaseClient()).toBe(supabase);
  expect(createClient).toHaveBeenCalledOnce();
  expect(createClient).toHaveBeenCalledWith(
    "https://fixtures.supabase.co",
    "anon-fixture",
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );
});
