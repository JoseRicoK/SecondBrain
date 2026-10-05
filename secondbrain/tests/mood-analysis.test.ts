import { describe, it, expect } from "vitest";
import { MOOD_KEYS, buildDiaryAnalytics } from "@/lib/diary-analytics";
import {
  MOOD_ANALYSIS_FORMAT,
  MOOD_ANALYSIS_INSTRUCTIONS,
  parseMoodAnalysis,
} from "@/lib/mood-analysis";

const routine = {
  happiness: 0,
  tranquility: null,
  stress: 0,
  sadness: 0,
  neutral: 90,
};
describe("neutral and independent emotional intensities", () => {
  it("preserves routine neutrality, real zero and unknown calm separately", () => {
    expect(parseMoodAnalysis(routine)).toEqual(routine);
    expect(
      parseMoodAnalysis(
        Object.fromEntries(MOOD_KEYS.map((key) => [key, null])),
      ),
    ).toEqual({
      happiness: null,
      tranquility: null,
      stress: null,
      sadness: null,
      neutral: null,
    });
  });
  it("does not normalize or cancel coexisting happiness and sadness", () => {
    const mixed = { ...routine, happiness: 80, sadness: 75, neutral: 10 };
    expect(parseMoodAnalysis(mixed)).toEqual(mixed);
  });
  it("rounds and bounds neutral just like the other independent scores", () => {
    expect(parseMoodAnalysis({ ...routine, neutral: 41.6 }).neutral).toBe(42);
    expect(parseMoodAnalysis({ ...routine, neutral: 101 }).neutral).toBe(100);
    expect(parseMoodAnalysis({ ...routine, neutral: -1 }).neutral).toBe(0);
  });
  it.each([undefined, "90", false, NaN, Infinity])(
    "rejects a malformed or missing neutral score instead of inventing it: %s",
    (score) => {
      expect(() => parseMoodAnalysis({ ...routine, neutral: score })).toThrow(
        "Invalid mood output",
      );
    },
  );
  it("asks for five explicit nullable dimensions and distinguishes neutral from calm and insufficient evidence", () => {
    expect(MOOD_ANALYSIS_FORMAT.schema.required).toEqual([...MOOD_KEYS]);
    expect(MOOD_ANALYSIS_FORMAT.strict).toBe(true);
    expect(MOOD_ANALYSIS_FORMAT.schema.properties.neutral).toEqual({
      type: ["number", "null"],
    });
    expect(MOOD_ANALYSIS_INSTRUCTIONS).toContain("no tienen que sumar 100");
    expect(MOOD_ANALYSIS_INSTRUCTIONS).toContain(
      "No uses 50 como valor por defecto",
    );
    expect(MOOD_ANALYSIS_INSTRUCTIONS).toContain("No significa calma");
    expect(MOOD_ANALYSIS_INSTRUCTIONS).toContain("devuelve null");
  });
  it("includes neutral-only days and people, excludes unknown historic values from averages and colours daily calendars", () => {
    const analytics = buildDiaryAnalytics(
      [
        {
          date: "2026-10-01",
          content: "Rutina con Ana",
          mentioned_people: ["Ana"],
          neutral: 90,
        },
        {
          date: "2026-09-30",
          content: "Historia antigua con Ana",
          mentioned_people: ["Ana"],
          happiness: 70,
        },
        {
          date: "2026-09-29",
          content: "Día emocional con Ana",
          mentioned_people: ["Ana"],
          happiness: 80,
          sadness: 75,
          neutral: 0,
        },
      ],
      "all",
      "2026-10-01",
    );
    expect(analytics.averages.neutral).toBe(45);
    expect(analytics.moodSamples).toBe(3);
    expect(analytics.people[0].emotions).toMatchObject({
      averages: { neutral: 45 },
      sampleCounts: { neutral: 2 },
    });
    expect(
      analytics.timeline.find((day) => day.date === "2026-09-30")?.neutral,
    ).toBeNull();
    expect(
      analytics.calendar.find((day) => day.date === "2026-10-01"),
    ).toMatchObject({ dominantEmotions: ["neutral"], dominantScore: 90 });
    expect(
      analytics.calendar.find((day) => day.date === "2026-09-29"),
    ).toMatchObject({ dominantEmotions: ["happiness"], dominantScore: 80 });
  });
});
