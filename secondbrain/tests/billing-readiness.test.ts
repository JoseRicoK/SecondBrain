import { it, expect, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase", () => ({ getDatabaseClient: () => ({ rpc }) }));
import { hasBillingSchema } from "@/lib/billing-readiness";
it.each([
  { data: null, error: { message: "missing function" } },
  { data: 1, error: null },
  { data: 2, error: { message: "DB unavailable" } },
])(
  "activation fails closed without verified current schema",
  async (result) => {
    rpc.mockResolvedValue(result);
    expect(await hasBillingSchema()).toBe(false);
  },
);
it("current schema permits configuration readiness", async () => {
  rpc.mockResolvedValue({ data: 2, error: null });
  expect(await hasBillingSchema()).toBe(true);
});
