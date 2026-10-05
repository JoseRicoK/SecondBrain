// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MOOD_KEYS, type MoodValues } from "@/lib/diary-analytics";
import { moodDistribution } from "@/lib/mood-distribution";
import EmotionTooltip from "@/components/statistics/EmotionTooltip";
const values: MoodValues = {
  happiness: 30,
  tranquility: 20,
  stress: 25,
  sadness: 0,
  neutral: 55,
};

it("normalizes the five scores to exactly 100% while retaining the original independent intensities", () => {
  const source = Object.freeze({ ...values });
  const result = moodDistribution(source);
  expect(result).toMatchObject({
    total: 130,
    partial: false,
    known: 5,
    percentages: {
      happiness: 23.1,
      tranquility: 15.4,
      stress: 19.2,
      sadness: 0,
      neutral: 42.3,
    },
  });
  expect(source).toEqual(values);
});
it("preserves unknown dimensions and real zero; does not invent neutrality for a zero denominator", () => {
  const partial = moodDistribution({ ...values, tranquility: null });
  expect(partial.percentages.tranquility).toBeNull();
  expect(partial.percentages.sadness).toBe(0);
  expect(partial.partial).toBe(true);
  expect(
    Object.values(partial.percentages).reduce<number>(
      (sum, value) => sum + (value ?? 0),
      0,
    ),
  ).toBeCloseTo(100, 8);
  for (const missing of [null, 0]) {
    const empty = moodDistribution(
      Object.fromEntries(MOOD_KEYS.map((key) => [key, missing])) as MoodValues,
    );
    expect(Object.values(empty.percentages)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(empty.total).toBe(0);
  }
});
it("keeps displayed rounding totals correct for ties, fractional averages and high mixed emotions", () => {
  for (const inputs of [
    [1, 1, 1, 0, 0],
    [100, 100, 100, 100, 100],
    [0.1, 0.2, null, 0, 0.7],
    [99, 1, 0, 0, 0],
  ]) {
    const result = moodDistribution(
      Object.fromEntries(
        MOOD_KEYS.map((key, index) => [key, inputs[index]]),
      ) as MoodValues,
    );
    const sum = Object.values(result.percentages).reduce<number>(
      (total, value) => total + (value ?? 0),
      0,
    );
    expect(sum).toBeCloseTo(100, 8);
    for (const [index, key] of MOOD_KEYS.entries()) {
      if (inputs[index] === null) expect(result.percentages[key]).toBeNull();
      if (inputs[index] === 0) expect(result.percentages[key]).toBe(0);
    }
  }
});
it("tooltip separates relative percentages from original intensities and names unknown values", () => {
  const point = {
    ...values,
    date: "2026-10-01",
    startDate: "2026-10-01",
    endDate: "2026-10-01",
    entries: 1,
    samples: 1,
    timestamp: 0,
    distribution: moodDistribution(values),
    shares: values,
  };
  const view = render(<EmotionTooltip active payload={[{ payload: point }]} />);
  expect(screen.getByText("23,1 %")).toBeVisible();
  expect(screen.getByText("30/100")).toBeVisible();
  expect(screen.getByText("0/100")).toBeVisible();
  const updated = {
    ...point,
    tranquility: null,
    distribution: moodDistribution({ ...values, tranquility: null }),
  };
  view.rerender(<EmotionTooltip active payload={[{ payload: updated }]} />);
  expect(screen.getByText("Sin datos")).toBeVisible();
  expect(screen.getByText(/4 de 5 emociones evaluadas/)).toBeVisible();
  view.rerender(
    <EmotionTooltip active={false} payload={[{ payload: point }]} />,
  );
  expect(view.container).toBeEmptyDOMElement();
});
