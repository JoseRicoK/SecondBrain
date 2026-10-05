import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { getDatabaseClient } from "@/lib/supabase";
import { requireStatisticsPlan } from "@/lib/statistics-service";
import { readAnalyticsPeople } from "@/lib/statistics-data";
import { createPersonMentionResolver } from "@/lib/person-mentions";
import { personNameKey } from "@/lib/person-information";
import {
  ANALYTICS_PERIODS,
  analyticsRange,
  diaryToday,
  entryMoodValues,
  type AnalyticsEntry,
  type AnalyticsPeriod,
} from "@/lib/diary-analytics";

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
    const source = params.get("source")?.trim() || "";
    const target = params.get("target")?.trim() || "";
    const period = (params.get("period") || "all") as AnalyticsPeriod;
    const dates = [...new Set((params.get("dates") || "").split(","))];
    const today = diaryToday();
    const range = ANALYTICS_PERIODS.includes(period)
      ? analyticsRange(period, today)
      : null;
    if (
      !source ||
      !target ||
      source.length > 120 ||
      target.length > 120 ||
      personNameKey(source) === personNameKey(target) ||
      !range ||
      !dates.length ||
      dates.length > 12 ||
      dates.some(
        (date) =>
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !Number.isFinite(Date.parse(date)) ||
          new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date ||
          date > today ||
          (range.start && date < range.start),
      )
    )
      return NextResponse.json(
        { error: "Conexión o fechas no válidas" },
        { status: 400, headers },
      );
    if (!(await requireStatisticsPlan(user.uid)))
      return NextResponse.json(
        { error: "Las estadísticas requieren un plan de pago" },
        { status: 403, headers },
      );
    // Dates are a bounded selection, not authorization: recheck owner and both mentions.
    const resolver = createPersonMentionResolver(
      await readAnalyticsPeople(user.uid),
    );
    const sourceKey = personNameKey(resolver.resolve(source));
    const targetKey = personNameKey(resolver.resolve(target));
    if (sourceKey === targetKey)
      return NextResponse.json(
        { error: "Selecciona dos personas diferentes" },
        { status: 400, headers },
      );
    const { data, error } = await getDatabaseClient()
      .from("diary_entries")
      .select(
        "date, content, mentioned_people, happiness, tranquility, stress, sadness, neutral",
      )
      .eq("user_id", user.uid)
      .in("date", dates)
      .lte("date", today)
      .order("date", { ascending: false })
      .limit(12);
    if (error) throw new Error("Connection query failed");
    const entries = (data || [])
      .filter((entry: AnalyticsEntry) => {
        if (!dates.includes(entry.date) || !entry.content?.trim()) return false;
        const names = new Set(
          resolver
            .mentions(entry.mentioned_people, entry.content)
            .map(personNameKey),
        );
        return names.has(sourceKey) && names.has(targetKey);
      })
      .map((entry: AnalyticsEntry) => {
        const text = entry.content.replace(/\s+/gu, " ").trim();
        return {
          date: entry.date,
          excerpt:
            text.length > 200 ? `${text.slice(0, 200).trimEnd()}…` : text,
          ...entryMoodValues(entry),
        };
      });
    return NextResponse.json({ entries }, { headers });
  } catch {
    return NextResponse.json(
      {
        error:
          "No se pudieron cargar los recuerdos compartidos. Puedes reintentarlo.",
      },
      { status: 500, headers },
    );
  }
}
