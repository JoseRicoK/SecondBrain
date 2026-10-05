import { MOOD_KEYS, type MoodValues } from "./diary-analytics";

// Presentation only. Keep stored intensities and missing dimensions unchanged.
export function moodDistribution(values: MoodValues) {
  const known = MOOD_KEYS.filter((key) => values[key] !== null);
  const total = known.reduce((sum, key) => sum + values[key]!, 0);
  const percentages = Object.fromEntries(
    MOOD_KEYS.map((key) => [key, null]),
  ) as MoodValues;
  if (total > 0) {
    // Allocate tenths by largest remainder: displayed percentages sum to 100,
    // without changing unknown dimensions or assigning a share to a real zero.
    const portions = known.map((key, index) => {
      const exact = (values[key]! / total) * 1000;
      return {
        key,
        index,
        units: Math.floor(exact),
        remainder: exact - Math.floor(exact),
      };
    });
    let remainder = 1000 - portions.reduce((sum, part) => sum + part.units, 0);
    for (const part of [...portions].sort(
      (a, b) => b.remainder - a.remainder || a.index - b.index,
    )) {
      if (remainder-- <= 0) break;
      part.units++;
    }
    for (const part of portions) percentages[part.key] = part.units / 10;
  }
  return {
    total,
    percentages,
    partial: known.length < MOOD_KEYS.length,
    known: known.length,
  };
}
