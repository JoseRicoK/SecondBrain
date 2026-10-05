import { it, expect, beforeEach, vi } from "vitest";
import { mockDatabase } from "./helpers/database";
const mock = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getDatabaseClient: mock.client }));
import {
  claimCheckoutAttempt,
  registerCheckoutSession,
  readCheckoutAttempt,
  releaseCheckoutAttempt,
} from "@/lib/checkout-attempts";
const db = mockDatabase();
beforeEach(() => {
  db.reset();
  mock.client.mockReturnValue(db);
});
it("reservations derive their owner and requested plan from the server request", async () => {
  const data = {
    requestId: "r",
    plan: "pro",
    sessionId: null,
    expiresAt: "2030-01-01",
  };
  db.reply(data);
  expect(await claimCheckoutAttempt("u", "r", "pro")).toEqual(data);
  expect(db.rpc).toHaveBeenCalledWith("claim_checkout_attempt", {
    p_user_id: "u",
    p_request_id: "r",
    p_plan: "pro",
  });
});
it.each([null, { message: "Failure" }])(
  "missing/failed reservation rejects payment creation",
  async (error) => {
    db.reply(null, error);
    await expect(claimCheckoutAttempt("u", "r", "pro")).rejects.toBeDefined();
  },
);
it("reads and releases only the owner's exact attempt", async () => {
  db.reply({
    request_id: "r",
    plan: "pro",
    session_id: "cs",
    expires_at: "2030-01-01",
  });
  expect(await readCheckoutAttempt("u")).toMatchObject({
    requestId: "r",
    sessionId: "cs",
  });
  await releaseCheckoutAttempt("u", "r");
  expect(db.calls[1].steps).toContainEqual(["eq", "user_id", "u"]);
  expect(db.calls[1].steps).toContainEqual(["eq", "request_id", "r"]);
});
it("persists a provider session only through the guarded RPC", async () => {
  await registerCheckoutSession("u", "r", "cs");
  expect(db.rpc).toHaveBeenCalledWith("register_checkout_session", {
    p_user_id: "u",
    p_request_id: "r",
    p_session_id: "cs",
  });
  db.reply(null, { message: "Superseded" });
  await expect(
    registerCheckoutSession("u", "r", "other"),
  ).rejects.toBeDefined();
});
