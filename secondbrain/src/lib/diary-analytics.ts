import { cleanPersonName, personNameKey } from "./person-information";

export const ANALYTICS_PERIODS = ["all", "7", "30", "90", "365"] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];
export const MOOD_KEYS = [
  "happiness",
  "tranquility",
  "stress",
  "sadness",
  "neutral",
] as const;
export type MoodKey = (typeof MOOD_KEYS)[number];
export type MoodValues = Record<MoodKey, number | null>;
export type AnalyticsEntry = {
  date: string;
  content: string;
  mentioned_people?: string[] | null;
  mentioned_person_ids?: string[] | null;
} & Partial<Record<MoodKey, number | string | null>>;
export type EntryEmotions = { date: string } & MoodValues;
export type PersonEmotions = {
  samples: number;
  averages: MoodValues;
  sampleCounts: Record<MoodKey, number>;
  entries: EntryEmotions[];
};
export type ConnectionMetric = {
  key: string;
  source: string;
  target: string;
  sourceLabel?: string;
  targetLabel?: string;
  count: number;
  dates: string[];
};
export type ConnectionEntry = EntryEmotions & { excerpt: string };
export type PersonMetric = {
  name: string;
  displayName?: string;
  relationship?: string;
  count: number;
  share: number;
  firstDate: string;
  lastDate: string;
  dates: string[];
  emotions?: PersonEmotions;
};
export const personLabel = (person: Pick<PersonMetric, "name" | "displayName">) => person.displayName || person.name;

export type SavedReport = {
  weekSummary: string;
  instagramQuote: string;
  generatedAt: string;
};
export type DiaryAnalytics = ReturnType<typeof buildDiaryAnalytics>;
export type AnalyticsResponse = {
  analytics: DiaryAnalytics;
  report: SavedReport | null;
};

// UTC date-only arithmetic avoids DST shifts; the diary's day comes from Madrid.
export function diaryToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDiaryDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
const distance = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000,
  );
const validDate = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  Number.isFinite(Date.parse(date)) &&
  new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
export function analyticsRange(period: AnalyticsPeriod, today = diaryToday()) {
  const days = period === "all" ? null : Number(period);
  return {
    end: today,
    start: days ? addDiaryDays(today, 1 - days) : null,
    queryStart: days ? addDiaryDays(today, 1 - days * 2) : null,
  };
}
function mood(entry: Pick<AnalyticsEntry, MoodKey>, key: MoodKey) {
  const raw = entry[key];
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}
export function entryMoodValues(
  entry: Pick<AnalyticsEntry, MoodKey>,
): MoodValues {
  return Object.fromEntries(
    MOOD_KEYS.map((key) => [key, mood(entry, key)]),
  ) as MoodValues;
}
function average(entries: AnalyticsEntry[], key: MoodKey) {
  const values = entries
    .map((e) => mood(e, key))
    .filter((v): v is number => v !== null);
  return values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : null;
}
const words = (content: string) =>
  content.trim().split(/\s+/u).filter(Boolean).length;
const weekdayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export type MoodTimelinePoint = EntryEmotions & {
  timestamp: number;
  startDate: string;
  endDate: string;
  entries: number;
  samples: number;
};
const hasMood = (entry: AnalyticsEntry) =>
  MOOD_KEYS.some((key) => mood(entry, key) !== null);

function moodTimeline(
  selected: AnalyticsEntry[],
  start: string,
  today: string,
) {
  const analysed = selected.filter(hasMood);
  const byDate = new Map(selected.map((entry) => [entry.date, entry]));
  const point = (date: string, group: AnalyticsEntry[]): MoodTimelinePoint => {
    const samples = group.filter(hasMood);
    const first = samples[0]?.date || date;
    return {
      // An averaged point is anchored to an actual sampled date, never an empty day.
      date: first,
      timestamp: Date.parse(`${first}T12:00:00Z`),
      startDate: first,
      endDate: samples.at(-1)?.date || date,
      entries: group.length,
      samples: samples.length,
      ...(Object.fromEntries(
        MOOD_KEYS.map((key) => [key, average(group, key)]),
      ) as MoodValues),
    };
  };
  const daily = (date: string) =>
    point(date, byDate.has(date) ? [byDate.get(date)!] : []);
  const totalDays = distance(start, today) + 1;
  if (totalDays <= 180)
    return {
      bucketDays: 1,
      timeline: Array.from({ length: totalDays }, (_, index) =>
        daily(addDiaryDays(start, index)),
      ),
    };
  // Sparse diaries retain every exact date. Null separators break lines over gaps
  // without allocating a point for every empty day across decades.
  if (analysed.length <= 90) {
    const timeline: MoodTimelinePoint[] = [];
    for (const entry of analysed) {
      const previous = timeline.at(-1);
      if (previous && distance(previous.date, entry.date) > 1)
        timeline.push(daily(addDiaryDays(previous.date, 1)));
      timeline.push(point(entry.date, [entry]));
    }
    if (timeline.at(-1)?.date !== today) timeline.push(daily(today));
    return { bucketDays: 1, timeline };
  }
  // At most 120 older calendar buckets + 30 recent daily points. Recent dates
  // must never disappear inside a week/month average, regardless of history size.
  const recentStart = addDiaryDays(today, -29);
  const olderDays = distance(start, recentStart);
  const bucketDays = Math.max(1, Math.ceil(olderDays / 120));
  const buckets = new Map<number, AnalyticsEntry[]>();
  for (const entry of selected) {
    if (entry.date >= recentStart) break;
    const index = Math.floor(distance(start, entry.date) / bucketDays);
    const group = buckets.get(index) || [];
    group.push(entry);
    buckets.set(index, group);
  }
  const timeline = Array.from(
    { length: Math.ceil(olderDays / bucketDays) },
    (_, index) =>
      point(addDiaryDays(start, index * bucketDays), buckets.get(index) || []),
  );
  // Prevent an old average from drawing a continuous line across unrecorded days
  // before the first daily sample in the recent window.
  const lastSample = [...timeline].reverse().find((value) => value.samples);
  if (lastSample && distance(lastSample.endDate, recentStart) > 1) {
    const gap = addDiaryDays(lastSample.endDate, 1);
    if (timeline.at(-1)!.date < gap) timeline.push(daily(gap));
  }
  for (let index = 0; index < 30; index++)
    timeline.push(daily(addDiaryDays(recentStart, index)));
  return { bucketDays, timeline };
}

export function buildDiaryAnalytics(
  input: AnalyticsEntry[],
  period: AnalyticsPeriod,
  today = diaryToday(),
) {
  const range = analyticsRange(period, today);
  // SQL guarantees one date per owner. Deduplicate defensively without double counting.
  const entries = [
    ...new Map(
      input
        .filter(
          (e) =>
            validDate(e.date) &&
            e.date <= today &&
            typeof e.content === "string" &&
            e.content.trim(),
        )
        .map((e) => [e.date, e]),
    ).values(),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const selected = entries.filter((e) => !range.start || e.date >= range.start);
  const previous = range.start
    ? entries.filter(
        (e) => e.date < range.start! && e.date >= range.queryStart!,
      )
    : [];
  const start = range.start || selected[0]?.date || today;
  const totalDays = distance(start, today) + 1;
  const wordCounts = new Map(selected.map((e) => [e.date, words(e.content)]));
  const totalWords = [...wordCounts.values()].reduce(
    (sum, count) => sum + count,
    0,
  );
  let bestStreak = 0,
    run = 0,
    lastDate = "";
  for (const e of selected) {
    run = lastDate && addDiaryDays(lastDate, 1) === e.date ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    lastDate = e.date;
  }
  const dateSet = new Set(selected.map((e) => e.date));
  let currentStreak = 0;
  let cursor = dateSet.has(today) ? today : addDiaryDays(today, -1);
  while (dateSet.has(cursor)) {
    currentStreak++;
    cursor = addDiaryDays(cursor, -1);
  }
  const peopleMap = new Map<
    string,
    { name: string; entries: AnalyticsEntry[] }
  >();
  const pairMap = new Map<
    string,
    { sourceKey: string; targetKey: string; count: number; dates: string[] }
  >();
  for (const e of selected) {
    const names = new Map(
      (e.mentioned_people || [])
        .filter((n) => typeof n === "string" && n.trim())
        .map((n) => [personNameKey(n), cleanPersonName(n)]),
    );
    for (const [key, name] of names) {
      const item = peopleMap.get(key) || { name, entries: [] };
      item.entries.push(e);
      peopleMap.set(key, item);
    }
    // An unordered pair counts once per saved date, not once per name occurrence.
    const keys = [...names.keys()].sort();
    for (let i = 0; i < keys.length; i++)
      for (let j = i + 1; j < keys.length; j++) {
        const key = JSON.stringify([keys[i], keys[j]]);
        const pair = pairMap.get(key) || {
          sourceKey: keys[i],
          targetKey: keys[j],
          count: 0,
          dates: [],
        };
        pair.count++;
        pair.dates.push(e.date);
        if (pair.dates.length > 12) pair.dates.shift();
        pairMap.set(key, pair);
      }
  }
  const people: PersonMetric[] = [...peopleMap.values()]
    .map((p) => ({
      name: p.name,
      count: p.entries.length,
      share: Math.round((100 * p.entries.length) / (selected.length || 1)),
      firstDate: p.entries[0].date,
      lastDate: p.entries.at(-1)!.date,
      dates: p.entries
        .slice(-12)
        .reverse()
        .map((entry) => entry.date),
      emotions: {
        samples: p.entries.filter((entry) =>
          MOOD_KEYS.some((key) => mood(entry, key) !== null),
        ).length,
        averages: Object.fromEntries(
          MOOD_KEYS.map((key) => [key, average(p.entries, key)]),
        ) as MoodValues,
        sampleCounts: Object.fromEntries(
          MOOD_KEYS.map((key) => [
            key,
            p.entries.filter((entry) => mood(entry, key) !== null).length,
          ]),
        ) as Record<MoodKey, number>,
        entries: p.entries
          .slice(-12)
          .reverse()
          .map((entry) => ({ date: entry.date, ...entryMoodValues(entry) })),
      },
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
  const connections: ConnectionMetric[] = [...pairMap.entries()]
    .map(([key, pair]) => ({
      key,
      source: peopleMap.get(pair.sourceKey)!.name,
      target: peopleMap.get(pair.targetKey)!.name,
      count: pair.count,
      dates: [...pair.dates].reverse(),
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  const weekday = weekdayNames.map((label) => ({ label, count: 0 }));
  for (const entry of selected)
    weekday[(new Date(`${entry.date}T12:00:00Z`).getUTCDay() + 6) % 7].count++;
  const frequentDay = [...weekday].sort((a, b) => b.count - a.count)[0];
  const { timeline, bucketDays } = moodTimeline(selected, start, today);
  const moodSamples = selected.filter(hasMood).length;
  const averages = Object.fromEntries(
    MOOD_KEYS.map((k) => [k, average(selected, k)]),
  ) as MoodValues;
  const previousAverages = Object.fromEntries(
    MOOD_KEYS.map((k) => [k, average(previous, k)]),
  ) as MoodValues;
  // In all-history mode show the most recent recorded activity, labelled with its dates.
  const calendarEnd = period === "all" ? selected.at(-1)?.date || today : today;
  const calendarLastSunday = addDiaryDays(
    calendarEnd,
    (7 - new Date(`${calendarEnd}T12:00:00Z`).getUTCDay()) % 7,
  );
  const calendarStart = addDiaryDays(calendarLastSunday, -83);
  const entriesByDate = new Map(selected.map((entry) => [entry.date, entry]));
  const calendar = Array.from({ length: 84 }, (_, i) => {
    const date = addDiaryDays(calendarStart, i);
    const entry = entriesByDate.get(date);
    const scores = MOOD_KEYS.map((key) => ({
      key,
      score: entry ? mood(entry, key) : null,
    })).filter(
      (item): item is { key: MoodKey; score: number } => item.score !== null,
    );
    const dominantScore = scores.length
      ? Math.max(...scores.map((item) => item.score))
      : null;
    const dominantEmotions = scores
      .filter((item) => item.score === dominantScore)
      .map((item) => item.key);
    return {
      date,
      dominantEmotions,
      dominantScore,
      words: wordCounts.get(date) || 0,
      hasEntry: wordCounts.has(date),
    };
  });
  return {
    period,
    start,
    end: today,
    totalDays,
    entryCount: selected.length,
    previousEntryCount: period === "all" ? null : previous.length,
    totalWords,
    averageWords: selected.length
      ? Math.round(totalWords / selected.length)
      : 0,
    activePercent: Math.round((100 * selected.length) / totalDays),
    currentStreak,
    bestStreak,
    people,
    connections,
    weekday,
    frequentDay: selected.length ? frequentDay.label : null,
    timeline,
    bucketDays,
    moodSamples,
    averages,
    previousAverages,
    calendar,
    calendarStart,
    calendarEnd: calendarLastSunday,
  };
}
