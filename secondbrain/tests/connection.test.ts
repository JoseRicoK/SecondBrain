import { expect, it, vi } from "vitest";
const session = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: session } },
}));
import { testSupabaseConnection } from "@/lib/supabase-test";
it("reports configured connection", async () => {
  session.mockResolvedValue({ error: null });
  expect(await testSupabaseConnection()).toMatchObject({ success: true });
});
it.each([new Error("offline"), "unknown"])(
  "reports connection errors without throwing",
  async (error) => {
    session.mockRejectedValue(error);
    expect(await testSupabaseConnection()).toEqual({
      success: false,
      error: error instanceof Error ? "offline" : "Error desconocido",
    });
  },
);
