import { expect, it, vi } from "vitest";
vi.mock("@/lib/supabase-operations", () => ({
  getDiaryEntriesByUserId: vi.fn(),
  getEntriesMoodDataByDateRange: vi.fn(),
}));
vi.mock("@/lib/subscription-snapshot", () => ({
  getSubscriptionSnapshot: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ getDatabaseClient: vi.fn() }));
import { rankPeople, statisticsRange } from "@/lib/statistics-service";
it("uses exactly seven diary dates, including today", () => {
  expect(statisticsRange("week", new Date("2026-09-30T12:00:00Z"))).toEqual({
    start: "2026-09-24",
    end: "2026-09-30",
  });
});
it("month/year stop today, not at future calendar dates", () => {
  const now = new Date("2026-09-30T12:00:00Z");
  expect(statisticsRange("month", now)).toEqual({
    start: "2026-09-01",
    end: "2026-09-30",
  });
  expect(statisticsRange("year", now)).toEqual({
    start: "2026-01-01",
    end: "2026-09-30",
  });
});
it("Madrid midnight and year boundary preserve the diary date", () => {
  expect(statisticsRange("week", new Date("2026-12-31T23:30:00Z"))).toEqual({
    start: "2026-12-26",
    end: "2027-01-01",
  });
});
it("ranks distinct names once per diary, and caps at twenty", () => {
  const entries = Array.from({ length: 25 }, (_, i) => ({
    mentioned_people: [`P${i}`, `P${i}`],
  }));
  const rank = rankPeople([...entries, { mentioned_people: ["P24", "P24"] }]);
  expect(rank).toHaveLength(20);
  expect(rank[0]).toEqual({ name: "P24", count: 2 });
});
