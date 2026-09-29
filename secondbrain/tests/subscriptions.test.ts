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
it("explicit subscription replacement serializes dates", async () => {
  db.reply(row);
  db.reply();
  await repo.createUserProfile(
    "u",
    {
      subscription: { plan: "elite", createdAt: new Date("2026-01-01") } as any,
    },
    false,
  );
  expect(db.calls[1].steps[0][1].subscription).toEqual({
    plan: "elite",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
});
it("partial subscription update preserves other billing fields", async () => {
  db.reply(row);
  db.reply();
  await repo.updateUserSubscription("u", { cancelAtPeriodEnd: true });
  expect(db.calls[1].steps[0][1].subscription).toMatchObject({
    plan: "pro",
    stripeCustomerId: "cus_test",
    cancelAtPeriodEnd: true,
    updatedAt: "2026-09-29T12:00:00.000Z",
  });
});
it("missing subscription uses free defaults", async () => {
  db.reply(null);
  db.reply();
  await repo.updateUserSubscription("u", { status: "active" });
  expect(db.calls[1].steps[0][1].subscription).toMatchObject({
    plan: "free",
    status: "active",
  });
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
  db.reply({ uid: "u" });
  expect(await repo.findUserByStripeCustomerId("cus_test")).toBe("u");
  expect(db.calls[0].steps).toContainEqual([
    "eq",
    "subscription->>stripeCustomerId",
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
it("retains this month usage", async () => {
  db.reply(row);
  expect(await repo.getUserMonthlyUsage("u")).toMatchObject({
    personalChatMessages: 2,
    personChatMessages: 3,
    statisticsAccess: 4,
    month: "2026-09",
  });
});
it.each(["2026-08", "2025-09", undefined])(
  "resets old/absent monthly usage %s",
  async (month) => {
    db.reply({
      ...row,
      subscription: {
        ...row.subscription,
        monthlyUsage: month
          ? { ...row.subscription.monthlyUsage, month }
          : undefined,
      },
    });
    expect(await repo.getUserMonthlyUsage("u")).toMatchObject({
      personalChatMessages: 0,
      personChatMessages: 0,
      statisticsAccess: 0,
      month: "2026-09",
    });
    expect(db.calls).toHaveLength(1);
  },
);
it("resets at the UTC year boundary", async () => {
  vi.setSystemTime(new Date("2027-01-01T00:00:00Z"));
  db.reply(row);
  expect(await repo.getUserMonthlyUsage("u")).toMatchObject({
    month: "2027-01",
    personalChatMessages: 0,
  });
});
it.each([
  [repo.incrementPersonalChatUsage, "personalChatMessages", 3],
  [repo.incrementPersonChatUsage, "personChatMessages", 4],
  [repo.incrementStatisticsAccess, "statisticsAccess", 5],
])("increments only its usage counter", async (run, key, value) => {
  db.reply(row);
  db.reply(row);
  db.reply();
  await run("u");
  expect(db.calls[2].steps[0][1].subscription.monthlyUsage).toMatchObject({
    ...row.subscription.monthlyUsage,
    [key]: value,
    lastUpdated: "2026-09-29T12:00:00.000Z",
  });
});
it("does not increment nonexistent profiles", async () => {
  db.reply(null);
  await repo.incrementPersonalChatUsage("u");
  expect(db.calls).toHaveLength(1);
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
  db.reply(row);
  db.reply(null, new Error("denied"));
  await expect(repo.updateUserSubscription("u", {})).rejects.toThrow("denied");
});
