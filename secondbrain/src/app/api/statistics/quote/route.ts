import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import {
  requireStatisticsPlan,
  readStatisticsReport,
} from "@/lib/statistics-service";
export async function GET(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await requireStatisticsPlan(user.uid)))
      return NextResponse.json({ error: "Plan requerido" }, { status: 403 });
    const cached = await readStatisticsReport(user.uid);
    if (!cached)
      return NextResponse.json(
        {
          error: "Genera un informe desde estadísticas",
          code: "REPORT_REQUIRED",
        },
        { status: 409 },
      );
    return NextResponse.json(
      { instagramQuote: cached.report.instagramQuote },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudo cargar el informe" },
      { status: 500 },
    );
  }
}
