import { currentPersonValue } from "@/lib/person-information";
import { readAnalyticsPeople } from "@/lib/statistics-data";
import { createPersonMentionResolver } from "@/lib/person-mentions";
import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { getDatabaseClient } from "@/lib/supabase";
import {
  requireStatisticsPlan,
  readStatisticsReport,
} from "@/lib/statistics-service";
import {
  ANALYTICS_PERIODS,
  analyticsRange,
  buildDiaryAnalytics,
  diaryToday,
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
    const period = new URL(request.url).searchParams.get("period") || "all";
    if (!ANALYTICS_PERIODS.includes(period as AnalyticsPeriod))
      return NextResponse.json(
        { error: "Periodo no válido" },
        { status: 400, headers },
      );
    // Never query personal data or invoke an AI provider before entitlement checks.
    if (!(await requireStatisticsPlan(user.uid)))
      return NextResponse.json(
        { error: "Las estadísticas requieren un plan de pago" },
        { status: 403, headers },
      );
    const today = diaryToday();
    const range = analyticsRange(period as AnalyticsPeriod, today);
    const entries: AnalyticsEntry[] = [];
    let after: string | null = null;
    // Keyset pagination avoids the Supabase row cap and large OFFSET scans.
    for (;;) {
      let query = getDatabaseClient()
        .from("diary_entries")
        .select(
          "date, content, mentioned_people, mentioned_person_ids, happiness, tranquility, stress, sadness, neutral",
        )
        .eq("user_id", user.uid)
        .lte("date", today)
        .order("date", { ascending: true })
        .limit(500);
      if (range.queryStart) query = query.gte("date", range.queryStart);
      if (after) query = query.gt("date", after);
      const { data, error } = await query;
      if (error) throw new Error("Diary query failed");
      entries.push(...(data || []));
      if (!data || data.length < 500) break;
      const next = data.at(-1)!.date;
      if (after && next <= after) throw new Error("Invalid pagination");
      after = next;
    }
    const people = await readAnalyticsPeople(user.uid);
    const resolver = createPersonMentionResolver(people);
    for (const entry of entries)
      entry.mentioned_people = resolver.mentions(
        entry.mentioned_people,
        entry.content || "",
        entry.mentioned_person_ids,
      );
    const analytics = buildDiaryAnalytics(
      entries,
      period as AnalyticsPeriod,
      today,
    );
    const labels = new Map<string, string>();
    for (const metric of analytics.people) {
      const match = people.find((person) => person.id === metric.name);
      if (match) {
        metric.displayName = match.name;
        metric.relationship = currentPersonValue(match.details, "relacion");
      } else if (
        people.filter(
          (person) =>
            person.name.toLocaleLowerCase() === metric.name.toLocaleLowerCase(),
        ).length > 1
      ) {
        metric.displayName = metric.name;
        metric.relationship = "Menciones antiguas sin asignar";
      }
      labels.set(metric.name, metric.displayName || metric.name);
    }
    for (const edge of analytics.connections) {
      edge.sourceLabel = labels.get(edge.source) || edge.source;
      edge.targetLabel = labels.get(edge.target) || edge.target;
    }
    const cached = await readStatisticsReport(user.uid);
    return NextResponse.json(
      {
        analytics,
        report: cached
          ? {
              weekSummary: cached.report.weekSummary,
              instagramQuote: cached.report.instagramQuote,
              generatedAt: cached.generated_at,
            }
          : null,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudieron cargar las estadísticas. Inténtalo de nuevo." },
      { status: 500, headers },
    );
  }
}
