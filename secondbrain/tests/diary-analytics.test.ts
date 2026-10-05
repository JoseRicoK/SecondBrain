import { describe, it, expect } from "vitest";
import {
  addDiaryDays,
  analyticsRange,
  buildDiaryAnalytics,
  diaryToday,
  MOOD_KEYS,
} from "@/lib/diary-analytics";
import {
  packPeople,
  packNetworkPeople,
} from "@/components/statistics/PeopleBubbles";
import { timelineDateLabel } from "@/components/statistics/presentation";
const today = "2026-10-01";
const entry = (date: string, extra: Record<string, unknown> = {}) => ({
  date,
  content: "Hoy escribí mi diario",
  ...extra,
});
describe("diary analytics", () => {
  it("uses Madrid dates and exactly equal rolling periods across DST and year boundaries", () => {
    expect(diaryToday(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    expect(analyticsRange("7", "2026-03-30")).toEqual({
      start: "2026-03-24",
      end: "2026-03-30",
      queryStart: "2026-03-17",
    });
    expect(addDiaryDays("2026-03-28", 2)).toBe("2026-03-30");
  });
  it("excludes future, invalid and blank dates; one count per diary date", () => {
    const result = buildDiaryAnalytics(
      [
        entry("2026-09-30"),
        entry("2026-09-30"),
        entry("2026-10-02"),
        entry("2026-02-30"),
        entry("2026-09-29", { content: "   " }),
      ],
      "all",
      today,
    );
    expect(result.entryCount).toBe(1);
    expect(result.totalWords).toBe(4);
    expect(result.averageWords).toBe(4);
    expect(result.end).toBe(today);
    expect(result.weekday.reduce((n, d) => n + d.count, 0)).toBe(
      result.entryCount,
    );
  });
  it("counts names once per entry with case/spacing equivalence but preserves different identities", () => {
    const r = buildDiaryAnalytics(
      [
        entry("2026-09-30", {
          mentioned_people: [" Vero ", "vero", "VERO", "Mamá", "mi madre"],
        }),
        entry(today, { mentioned_people: ["Vero"] }),
      ],
      "all",
      today,
    );
    expect(r.people[0]).toMatchObject({
      name: "VERO",
      count: 2,
      share: 100,
      firstDate: "2026-09-30",
      lastDate: today,
    });
    expect(r.people).toHaveLength(3);
  });
  it("keeps unknown emotion values null and real zero in averages and gaps", () => {
    const r = buildDiaryAnalytics(
      [
        entry("2026-09-29", { happiness: 100 }),
        entry(today, {
          happiness: 0,
          stress: null,
          tranquility: "",
          sadness: 130,
        }),
      ],
      "7",
      today,
    );
    expect(r.averages).toEqual({
      happiness: 50,
      stress: null,
      tranquility: null,
      sadness: null,
      neutral: null,
    });
    expect(r.moodSamples).toBe(2);
    expect(r.timeline.find((p) => p.date === "2026-09-30")).toMatchObject({
      entries: 0,
      happiness: null,
    });
  });
  it("reconciles previous-period counts, daily activity and streaks without joining gaps", () => {
    const r = buildDiaryAnalytics(
      [
        "2026-09-23",
        "2026-09-25",
        "2026-09-26",
        "2026-09-27",
        "2026-09-30",
        today,
      ].map((d) => entry(d)),
      "7",
      today,
    );
    expect(r.entryCount).toBe(5);
    expect(r.previousEntryCount).toBe(1);
    expect(r.bestStreak).toBe(3);
    expect(r.currentStreak).toBe(2);
    expect(r.activePercent).toBe(71);
    expect(r.calendar.filter((d) => d.hasEntry)).toHaveLength(5);
  });
  it("does not imply an ongoing streak after an unwritten yesterday", () => {
    expect(
      buildDiaryAnalytics(
        [entry("2026-09-28"), entry("2026-09-29")],
        "all",
        today,
      ).currentStreak,
    ).toBe(0);
  });
  it("retains old history and keeps long timelines bounded without fabricating scores", () => {
    const r = buildDiaryAnalytics(
      [entry("1990-01-01", { happiness: 80 }), entry("2025-01-01")],
      "all",
      today,
    );
    expect(r.entryCount).toBe(2);
    expect(r.timeline.length).toBeLessThanOrEqual(180);
    expect(r.timeline.filter((d) => d.happiness !== null)).toHaveLength(1);
    expect(r.calendarEnd).toBe("2025-01-05");
    expect(r.previousEntryCount).toBeNull();
  });
  it("empty diaries have no invented mood, people or streaks", () => {
    const r = buildDiaryAnalytics([], "all", today);
    expect(r.entryCount).toBe(0);
    expect(r.people).toEqual([]);
    expect(r.averages.happiness).toBeNull();
    expect(r.bestStreak).toBe(0);
    expect(r.activePercent).toBe(0);
  });
  it("packs twelve dense bubbles within bounds without overlaps", () => {
    const people = Array.from({ length: 12 }, (_, i) => ({
      name: `Persona ${i}`,
      count: 12,
      share: 100,
      firstDate: today,
      lastDate: today,
      dates: [today],
    }));
    const circles = packPeople(people);
    expect(circles).toHaveLength(12);
    for (const c of circles) {
      expect(c.x - c.r).toBeGreaterThanOrEqual(10);
      expect(c.x + c.r).toBeLessThanOrEqual(590);
      expect(c.y - c.r).toBeGreaterThanOrEqual(10);
      expect(c.y + c.r).toBeLessThanOrEqual(360);
    }
    for (let i = 0; i < circles.length; i++)
      for (let j = i + 1; j < circles.length; j++)
        expect(
          Math.hypot(circles[i].x - circles[j].x, circles[i].y - circles[j].y),
        ).toBeGreaterThanOrEqual(circles[i].r + circles[j].r + 9);
  });
  it("keeps the focused network central with twelve bounded non-overlapping nodes", () => {
    const people = Array.from({ length: 12 }, (_, i) => ({
      name: `Persona ${i}`,
      count: 12,
      share: 100,
      firstDate: today,
      lastDate: today,
      dates: [today],
    }));
    const circles = packNetworkPeople(people);
    expect(circles).toHaveLength(12);
    expect(circles[0]).toMatchObject({ x: 300, y: 185, person: people[0] });
    for (const [index, circle] of circles.entries()) {
      expect(circle.x - circle.r).toBeGreaterThanOrEqual(10);
      expect(circle.x + circle.r).toBeLessThanOrEqual(590);
      expect(circle.y - circle.r).toBeGreaterThanOrEqual(10);
      expect(circle.y + circle.r).toBeLessThanOrEqual(360);
      for (const other of circles.slice(index + 1))
        expect(
          Math.hypot(circle.x - other.x, circle.y - other.y),
        ).toBeGreaterThanOrEqual(circle.r + other.r + 9);
    }
  });
});

it("calendar aligns Mondays, uses daily scores rather than bucket means, preserves ties and unknowns", () => {
  const result = buildDiaryAnalytics(
    [
      entry("2026-09-28", { happiness: 80, tranquility: 80, stress: 10 }),
      entry("2026-09-29"),
      entry("2026-09-30", { happiness: 0 }),
      entry("2026-10-01", { happiness: 20, sadness: 95 }),
    ],
    "all",
    today,
  );
  expect(new Date(`${result.calendarStart}T12:00:00Z`).getUTCDay()).toBe(1);
  expect(result.calendar.find((d) => d.date === "2026-09-28")).toMatchObject({
    dominantEmotions: ["happiness", "tranquility"],
    dominantScore: 80,
  });
  expect(result.calendar.find((d) => d.date === "2026-09-29")).toMatchObject({
    hasEntry: true,
    dominantEmotions: [],
    dominantScore: null,
  });
  expect(result.calendar.find((d) => d.date === "2026-09-30")).toMatchObject({
    dominantEmotions: ["happiness"],
    dominantScore: 0,
  });
  expect(result.calendar.find((d) => d.date === today)).toMatchObject({
    dominantEmotions: ["sadness"],
    dominantScore: 95,
  });
  expect(result.calendar.find((d) => d.date === "2026-10-04")).toMatchObject({
    hasEntry: false,
    dominantEmotions: [],
  });
});

it("person emotions reconcile every valid score, keep real zeros and bound daily details", () => {
  const result = buildDiaryAnalytics(
    [
      entry("2026-09-29", {
        mentioned_people: ["Ana", "Ana"],
        happiness: 100,
        stress: null,
      }),
      entry("2026-09-30", {
        mentioned_people: ["ANA"],
        happiness: 0,
        stress: 70,
      }),
      entry(today, { mentioned_people: ["Ana"], happiness: null }),
      entry(today, { mentioned_people: ["Ana"], happiness: null }),
    ],
    "7",
    today,
  );
  expect(result.people[0]).toMatchObject({
    count: 3,
    emotions: {
      samples: 2,
      averages: { happiness: 50, stress: 70, tranquility: null },
      sampleCounts: { happiness: 2, stress: 1 },
      entries: [
        { date: today, happiness: null },
        { date: "2026-09-30", happiness: 0 },
        { date: "2026-09-29", happiness: 100 },
      ],
    },
  });
  expect(JSON.stringify(result)).not.toContain("Hoy escribí");
});
it("connections count unordered pairs once per date, apply the selected period and keep only recent dates", () => {
  const dates = Array.from({ length: 20 }, (_, index) =>
    addDiaryDays(today, -index),
  );
  const input = dates.map((date) =>
    entry(date, {
      mentioned_people: [" Ana ", "ANA", "Luis", "Luis", "Clara"],
    }),
  );
  input.push(entry("2025-01-01", { mentioned_people: ["Ana", "Luis"] }));
  const all = buildDiaryAnalytics(input, "all", today);
  expect(all.connections).toHaveLength(3);
  const pair = all.connections.find(
    (connection) =>
      (connection.target === "Luis" && connection.source === "Ana") ||
      (connection.target === "Luis" && connection.source === "ANA"),
  );
  expect(pair?.count).toBe(21);
  expect(pair?.dates).toEqual(dates.slice(0, 12));
  expect(
    all.people.find((person) => person.name === "Ana")?.emotions?.entries,
  ).toHaveLength(12);
  const week = buildDiaryAnalytics(input, "7", today);
  expect(week.connections.every((connection) => connection.count === 7)).toBe(
    true,
  );
  expect(
    week.connections.every(
      (connection) => connection.source !== connection.target,
    ),
  ).toBe(true);
  expect(
    buildDiaryAnalytics(
      [entry(today, { mentioned_people: ["Ana", "ANA"] })],
      "all",
      today,
    ).connections,
  ).toEqual([]);
});

it("does not label September 30 / October 1–2 as September 28 in a sparse long diary", () => {
  const recent = [
    entry("2026-09-30", { happiness: 5, stress: 10, neutral: 85 }),
    entry("2026-10-01", {
      happiness: 30,
      tranquility: 20,
      stress: 25,
      sadness: 0,
      neutral: 55,
    }),
    entry("2026-10-02", {
      happiness: 20,
      tranquility: 0,
      stress: 25,
      sadness: 0,
      neutral: 65,
    }),
  ];
  const result = buildDiaryAnalytics(
    [entry("2025-05-28", { happiness: 80 }), ...recent],
    "all",
    "2026-10-03",
  );
  expect(result.bucketDays).toBe(1);
  expect(
    result.timeline.find((value) => value.date === "2026-09-28"),
  ).toBeUndefined();
  for (const original of recent) {
    const point = result.timeline.find(
      (value) => value.date === original.date,
    )!;
    expect(point).toMatchObject({
      date: original.date,
      happiness: original.happiness,
      stress: original.stress,
      neutral: original.neutral,
      samples: 1,
    });
    expect(point).not.toHaveProperty("content");
    expect(point.timestamp).toBe(Date.parse(`${original.date}T12:00:00Z`));
  }
});

it("keeps dense long histories bounded, labels actual sampled ranges and preserves every recent day", () => {
  const input = Array.from({ length: 1000 }, (_, index) =>
    entry(addDiaryDays("2024-01-01", index), {
      happiness: index % 101,
      stress: index % 3 === 0 ? null : 0,
    }),
  );
  const end = input.at(-1)!.date;
  const result = buildDiaryAnalytics(input, "all", end);
  expect(result.timeline.length).toBeLessThanOrEqual(180);
  expect(result.bucketDays).toBeGreaterThan(1);
  expect(result.timeline.reduce((sum, point) => sum + point.samples, 0)).toBe(
    1000,
  );
  for (const original of input.slice(-30)) {
    expect(
      result.timeline.find((value) => value.date === original.date),
    ).toMatchObject({
      happiness: original.happiness,
      samples: 1,
      startDate: original.date,
      endDate: original.date,
    });
  }
  for (const point of result.timeline.filter((value) => value.samples > 1)) {
    const samples = input.filter(
      (value) => value.date >= point.startDate && value.date <= point.endDate,
    );
    expect(samples).toHaveLength(point.samples);
    expect(point.happiness).toBe(
      Math.round(
        samples.reduce((sum, value) => sum + value.happiness, 0) /
          samples.length,
      ),
    );
    expect(timelineDateLabel(point)).toContain(
      `media de ${point.samples} entradas`,
    );
    expect(timelineDateLabel(point)).toContain(" – ");
  }
});

it("uses an existing sampled date for aggregated points and never assigns emotions to empty days", () => {
  const input = Array.from({ length: 95 }, (_, index) =>
    entry(addDiaryDays("2000-01-01", index * 7), { happiness: 0 }),
  );
  input.push(entry("2026-10-01", { happiness: 40 }));
  const result = buildDiaryAnalytics(input, "all", "2026-10-03");
  const realDates = new Set(input.map((value) => value.date));
  for (const point of result.timeline) {
    if (MOOD_KEYS.some((key) => point[key] !== null)) {
      expect(realDates.has(point.date)).toBe(true);
      expect(realDates.has(point.startDate)).toBe(true);
      expect(realDates.has(point.endDate)).toBe(true);
    }
  }
  expect(
    result.timeline.find((value) => value.date === "2026-09-28"),
  ).toMatchObject({ happiness: null });
  expect(
    result.timeline.find((value) => value.date === "2026-10-01"),
  ).toMatchObject({ happiness: 40 });
  expect(result.timeline.length).toBeLessThanOrEqual(180);
});
