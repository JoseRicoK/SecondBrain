import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import {
  requireStatisticsPlan,
  getPeopleStatistics,
} from "@/lib/statistics-service";
export async function GET(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await requireStatisticsPlan(user.uid)))
      return NextResponse.json({ error: "Plan requerido" }, { status: 403 });
    return NextResponse.json(
      { topPeople: await getPeopleStatistics(user.uid) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudieron cargar las estadísticas" },
      { status: 500 },
    );
  }
}
