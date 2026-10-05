import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { getDatabaseClient } from "@/lib/supabase";
import { requireStatisticsPlan } from "@/lib/statistics-service";
import { readAnalyticsPeople } from "@/lib/statistics-data";
import { createPersonMentionResolver } from "@/lib/person-mentions";
import { personNameKey } from "@/lib/person-information";
import {
  ANALYTICS_PERIODS,
  MOOD_KEYS,
  analyticsRange,
  diaryToday,
  entryMoodValues,
  type AnalyticsEntry,
  type AnalyticsPeriod,
  type MoodKey,
  type EntryEmotions,
} from "@/lib/diary-analytics";

// Scores and dates are validated before interpolation into the keyset expression.
const realDate = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  Number.isFinite(Date.parse(date)) &&
  new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const user = await getRequestUser(request);
    if (!user)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers },
      );
    const params = new URL(request.url).searchParams;
    const person = params.get("person")?.trim() || "";
    const emotion = params.get("emotion") as MoodKey;
    const period = (params.get("period") || "all") as AnalyticsPeriod;
    const today = diaryToday();
    const range = ANALYTICS_PERIODS.includes(period)
      ? analyticsRange(period, today)
      : null;
    const cursor = params.get("cursor") || "";
    const parts = /^(\d+(?:\.\d+)?)\|(\d{4}-\d{2}-\d{2})$/.exec(cursor);
    if (
      !person ||
      person.length > 120 ||
      !MOOD_KEYS.includes(emotion) ||
      !range ||
      (cursor &&
        (!parts ||
          !realDate(parts[2]) ||
          Number(parts[1]) > 100 ||
          parts[2] > today ||
          (range.start && parts[2] < range.start)))
    )
      return NextResponse.json(
        { error: "Persona, emoción o periodo no válidos" },
        { status: 400, headers },
      );
    if (!(await requireStatisticsPlan(user.uid)))
      return NextResponse.json(
        { error: "Las estadísticas requieren un plan de pago" },
        { status: 403, headers },
      );
    const resolver = createPersonMentionResolver(
      await readAnalyticsPeople(user.uid),
    );
    const personKey = personNameKey(resolver.resolve(person));
    const entries: EntryEmotions[] = [];
    let after = parts ? { score: Number(parts[1]), date: parts[2] } : null;
    // Bounded scans: rare mentions may require another explicit page. Never rescan OFFSET history.
    for (let batch = 0; batch < 2; batch++) {
      let query = getDatabaseClient()
        .from("diary_entries")
        .select(
          "date, content, mentioned_people, happiness, tranquility, stress, sadness, neutral",
        )
        .eq("user_id", user.uid)
        .lte("date", today)
        .gte(emotion, 0)
        .lte(emotion, 100)
        .order(emotion, { ascending: false })
        .order("date", { ascending: false })
        .limit(100);
      if (range.start) query = query.gte("date", range.start);
      if (after)
        query = query.or(
          `${emotion}.lt.${after.score},and(${emotion}.eq.${after.score},date.lt.${after.date})`,
        );
      const { data, error } = await query;
      if (error) throw new Error("Emotion query failed");
      const rows = (data || []) as AnalyticsEntry[];
      for (let i = 0; i < rows.length; i++) {
        const entry = rows[i];
        const values = entryMoodValues(entry);
        const score = values[emotion];
        if (
          score === null ||
          !realDate(entry.date) ||
          (after &&
            (score > after.score ||
              (score === after.score && entry.date >= after.date)))
        )
          throw new Error("Invalid ranking order");
        after = { score, date: entry.date };
        if (
          entry.date <= today &&
          (!range.start || entry.date >= range.start) &&
          entry.content?.trim() &&
          resolver
            .mentions(entry.mentioned_people, entry.content)
            .some((name) => personNameKey(name) === personKey)
        )
          entries.push({ date: entry.date, ...values });
        if (entries.length === 12)
          return NextResponse.json(
            {
              entries,
              nextCursor:
                i < rows.length - 1 || rows.length === 100
                  ? `${after.score}|${after.date}`
                  : null,
            },
            { headers },
          );
      }
      if (rows.length < 100)
        return NextResponse.json({ entries, nextCursor: null }, { headers });
    }
    return NextResponse.json(
      { entries, nextCursor: after ? `${after.score}|${after.date}` : null },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudieron cargar las entradas. Puedes reintentarlo." },
      { status: 500, headers },
    );
  }
}
