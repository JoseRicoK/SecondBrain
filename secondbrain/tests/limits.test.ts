import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserProfile } from "@/lib/subscription-operations";
import * as policy from "@/middleware/subscription";
vi.mock("@/lib/subscription-operations", () => ({ getUserProfile: vi.fn() }));
const profile = (plan: string, status = "active") =>
  ({ subscription: { plan, status } }) as any;
beforeEach(() => {
  vi.mocked(getUserProfile).mockReset();
});

describe("plan permissions and monthly boundaries", () => {
  for (const plan of ["free", "pro", "elite"] as const) {
    for (const status of ["active", "inactive", "canceled", "past_due"]) {
      const effective = plan === "free" || status === "active" ? plan : "free";
      it(`${plan}/${status}: effective plan and feature flags`, async () => {
        vi.mocked(getUserProfile).mockResolvedValue(profile(plan, status));
        expect(await policy.getEffectivePlan("u")).toBe(effective);
        expect(await policy.needsSubscriptionUpgrade("u")).toBe(
          plan !== "free" && status !== "active",
        );
        for (const feature of [
          "hasAdvancedFeatures",
          "hasPersonalChat",
          "hasStatistics",
        ] as const) {
          expect(await policy.canUseFeature("u", feature)).toBe(
            policy.PLAN_LIMITS[effective][feature],
          );
        }
        expect(await policy.canCreateTranscription("u", 10000)).toBe(true);
        expect(await policy.canManageMorePeople("u", 10000)).toBe(true);
      });
      for (const [fn, key] of [
        [policy.canSendPersonalChatMessage, "personalChatMessages"],
        [policy.canSendPersonChatMessage, "personChatMessages"],
        [policy.canAccessStatistics, "statisticsAccess"],
      ] as const) {
        it(`${plan}/${status}: ${key} at/below/above limit`, async () => {
          vi.mocked(getUserProfile).mockResolvedValue(profile(plan, status));
          const limit = policy.PLAN_LIMITS[effective][key];
          for (const usage of [
            0,
            Math.max(0, limit - 1),
            limit,
            limit + 1,
            99999,
          ]) {
            expect(await fn("u", usage)).toBe(limit === -1 || usage < limit);
          }
        });
      }
    }
  }
  for (const failure of [null, new Error("offline")]) {
    it(`fails closed for missing/error profile (${failure})`, async () => {
      if (failure) vi.mocked(getUserProfile).mockRejectedValue(failure);
      else vi.mocked(getUserProfile).mockResolvedValue(null);
      expect(await policy.getEffectivePlan("u")).toBe("free");
      expect(await policy.needsSubscriptionUpgrade("u")).toBe(true);
      expect(await policy.canUseFeature("u", "hasPersonalChat")).toBe(false);
      for (const fn of [
        policy.canCreateTranscription,
        policy.canManageMorePeople,
        policy.canSendPersonalChatMessage,
        policy.canSendPersonChatMessage,
        policy.canAccessStatistics,
      ])
        expect(await fn("u", 0)).toBe(false);
    });
  }
});
