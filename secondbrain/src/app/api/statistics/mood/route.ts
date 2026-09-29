import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import {
  requireStatisticsPlan,
  getMoodStatistics,
} from "@/lib/statistics-service";
export async function GET(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const period =
      new URL(request.url).searchParams.get("moodPeriod") || "week";
    if (!["week", "month", "year"].includes(period))
      return NextResponse.json({ error: "Periodo no válido" }, { status: 400 });
    if (!(await requireStatisticsPlan(user.uid)))
      return NextResponse.json({ error: "Plan requerido" }, { status: 403 });
    return NextResponse.json(
      {
        moodData: await getMoodStatistics(
          user.uid,
          period as "week" | "month" | "year",
        ),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudieron cargar las estadísticas" },
      { status: 500 },
    );
  }
}
