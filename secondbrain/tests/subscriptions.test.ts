import { beforeEach, expect, it, vi } from "vitest";
import { mockDatabase } from "./helpers/database";
import { getDatabaseClient } from "@/lib/supabase";
import * as repo from "@/lib/subscription-operations";
vi.mock("@/lib/supabase", () => ({ getDatabaseClient: vi.fn() }));
const db = mockDatabase();
const row = {
  uid: "u",
  email: "u@test.invalid",
  display_name: "Ana",
  is_google_user: false,
  created_at: "2026-01-01",
  last_login_at: "2026-01-01",
  subscription: {
    plan: "pro",
    status: "active",
    stripeCustomerId: "cus_test",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    currentPeriodEnd: "2026-12-31",
    monthlyUsage: {
      month: "2026-09",
      personalChatMessages: 2,
      personChatMessages: 3,
      statisticsAccess: 4,
      lastUpdated: "2026-09-01",
    },
  },
};
beforeEach(() => {
  db.reset();
  vi.mocked(getDatabaseClient).mockReturnValue(db as any);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T12:00:00Z"));
});
it("deserializes dates, usage and flags with owner filter", async () => {
  db.reply(row);
  expect(await repo.getUserProfile("u")).toMatchObject({
    uid: "u",
    displayName: "Ana",
    subscription: {
      plan: "pro",
      currentPeriodEnd: new Date("2026-12-31"),
      monthlyUsage: { personChatMessages: 3 },
    },
  });
  expect(db.calls[0].steps).toContainEqual(["eq", "uid", "u"]);
});
it("supplies safe defaults for a minimal profile", async () => {
  db.reply({ uid: "u", created_at: "2026-01-01" });
  expect(await repo.getUserProfile("u")).toMatchObject({
    email: "",
    displayName: "",
    subscription: { plan: "free", status: "inactive" },
  });
});
it.each([null, { message: "offline" }])(
  "returns null on missing/failed profile",
  async (error) => {
    db.reply(null, error);
    expect(await repo.getUserProfile("u")).toBeNull();
  },
);
it("creates identity fields only, preserving database subscription defaults", async () => {
  db.reply(null);
  db.reply();
  await repo.createUserProfile("u", {
    email: row.email,
    displayName: "Ana",
    subscription: { plan: "elite" } as any,
  });
  expect(db.calls[1].steps[0]).toEqual([
    "insert",
    { uid: "u", email: row.email, display_name: "Ana", is_google_user: false },
  ]);
});
it("login profile update preserves paid subscriptions", async () => {
  db.reply(row);
  db.reply();
  await repo.createUserProfile("u", {
    displayName: "Nuevo",
    subscription: { plan: "free" } as any,
  });
  expect(db.calls[1].steps[0][1]).toMatchObject({
    display_name: "Nuevo",
    email: row.email,
  });
  expect(db.calls[1].steps[0][1]).not.toHaveProperty("subscription");
});
it("partial subscription updates do not overwrite usage or other billing fields", async () => {
  db.reply({ user_id: "u" });
  await repo.updateUserSubscription("u", { cancelAtPeriodEnd: true });
  expect(db.calls[0].table).toBe("subscriptions");
  expect(db.calls[0].steps[0]).toEqual([
    "update",
    { cancel_at_period_end: true, updated_at: "2026-09-29T12:00:00.000Z" },
  ]);
  expect(db.calls[0].steps).toContainEqual(["eq", "user_id", "u"]);
});
it("missing subscriptions fail instead of inventing paid rows", async () => {
  db.reply(null);
  await expect(
    repo.updateUserSubscription("u", { status: "active" }),
  ).rejects.toThrow("Subscription not found");
});
it("typed subscription rows take precedence over legacy JSON", async () => {
  db.reply({
    ...row,
    subscriptions: {
      plan: "elite",
      status: "active",
      current_period_end: "2026-12-31",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    },
  });
  expect((await repo.getUserProfile("u"))?.subscription.plan).toBe("elite");
});
it("explicit replacement uses normalized fields and never writes profile JSON", async () => {
  db.reply(row);
  db.reply({ user_id: "u" });
  db.reply();
  await repo.createUserProfile(
    "u",
    { subscription: { plan: "elite" } as any },
    false,
  );
  expect(db.calls[1].table).toBe("subscriptions");
  expect(db.calls[2].steps[0][1]).not.toHaveProperty("subscription");
});
it.each([
  ["free", "inactive", true],
  ["pro", "active", true],
  ["elite", "past_due", false],
])("active subscription %s/%s", async (plan, status, expected) => {
  db.reply({ ...row, subscription: { plan, status } });
  expect(await repo.hasActiveSubscription("u")).toBe(expected);
});
it.each([
  ["welcome", repo.markWelcomeComplete, { is_first_login: false }],
  [
    "payment",
    repo.markFirstPaymentComplete,
    { has_completed_first_payment: true, show_welcome_modal: true },
  ],
  ["seen", repo.markWelcomeModalSeen, { show_welcome_modal: false }],
])("%s updates only intended flags", async (_, run, payload) => {
  db.reply();
  await (run as Function)("u");
  expect(db.calls[0].steps).toContainEqual(["update", payload]);
  expect(db.calls[0].steps).toContainEqual(["eq", "uid", "u"]);
});
it("finds the user by Stripe customer ID", async () => {
  db.reply({ user_id: "u" });
  expect(await repo.findUserByStripeCustomerId("cus_test")).toBe("u");
  expect(db.calls[0].steps).toContainEqual([
    "eq",
    "stripe_customer_id",
    "cus_test",
  ]);
});
it.each([null, { message: "denied" }])(
  "does not invent a Stripe owner",
  async (error) => {
    db.reply(null, error);
    expect(await repo.findUserByStripeCustomerId("missing")).toBeNull();
  },
);
it("reads authoritative monthly usage including valid reservations", async () => {
  db.reply([
    { feature: "personalChatMessages", used: 2, reserved: 1 },
    { feature: "personChatMessages", used: 3, reserved: 0 },
  ]);
  expect(await repo.getUserMonthlyUsage("u")).toMatchObject({
    personalChatMessages: 3,
    personChatMessages: 3,
    statisticsAccess: 0,
    month: "2026-09",
  });
  expect(db.rpc).toHaveBeenCalledWith("read_monthly_usage", { p_user_id: "u" });
});
it("new months read fresh counters", async () => {
  vi.setSystemTime(new Date("2027-01-01T00:00:00Z"));
  db.reply([]);
  expect(await repo.getUserMonthlyUsage("u")).toMatchObject({
    month: "2027-01",
    personalChatMessages: 0,
  });
});
it("usage read errors never become zero usage", async () => {
  db.reply(null, new Error("offline"));
  await expect(repo.getUserMonthlyUsage("u")).rejects.toThrow("offline");
});
it.each([
  repo.incrementPersonalChatUsage,
  repo.incrementPersonChatUsage,
  repo.incrementStatisticsAccess,
])("compatibility increments reserve and finish once", async (run) => {
  db.reply({ allowed: true, id: "r" });
  db.reply();
  await run("u");
  expect(db.rpc.mock.calls[0][0]).toBe("reserve_usage");
  expect(db.rpc.mock.calls[1]).toEqual([
    "finish_usage",
    { p_user_id: "u", p_id: "r", p_success: true },
  ]);
});
it("exhausted usage never increments", async () => {
  db.reply({ allowed: false });
  await expect(repo.incrementPersonalChatUsage("u")).rejects.toThrow(
    "Monthly limit exceeded",
  );
  expect(db.rpc).toHaveBeenCalledTimes(1);
});
it("missing quota response fails closed", async () => {
  db.reply();
  await expect(repo.reserveUsage("u", "personalChatMessages")).rejects.toThrow(
    "Quota unavailable",
  );
});
it("finish errors propagate", async () => {
  db.reply(null, new Error("offline"));
  await expect(repo.finishUsage("u", "r", true)).rejects.toThrow("offline");
});
it.each([
  repo.markWelcomeComplete,
  repo.markFirstPaymentComplete,
  repo.markWelcomeModalSeen,
])("propagates flag persistence errors", async (run) => {
  db.reply(null, new Error("denied"));
  await expect(run("u")).rejects.toThrow("denied");
});
it("propagates subscription persistence errors", async () => {
  db.reply(null, new Error("denied"));
  await expect(repo.updateUserSubscription("u", {})).rejects.toThrow("denied");
});
