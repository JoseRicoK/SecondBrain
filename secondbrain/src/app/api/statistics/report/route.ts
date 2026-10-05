import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { reserveUsage, finishUsage } from "@/lib/subscription-operations";
import { getDatabaseClient } from "@/lib/supabase";
import {
  generateStatisticsReport,
  readStatisticsReport,
  requireStatisticsPlan,
} from "@/lib/statistics-service";
export const maxDuration = 180;
export async function POST(request: Request) {
  let owner: string | undefined;
  let reservationId: string | undefined;
  try {
    const user = await getRequestUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    if (body.userId && body.userId !== user.uid)
      return NextResponse.json({ error: "User mismatch" }, { status: 403 });
    if (body.refresh !== undefined && typeof body.refresh !== "boolean")
      return NextResponse.json({ error: "Invalid refresh" }, { status: 400 });
    owner = user.uid;
    if (!(await requireStatisticsPlan(owner)))
      return NextResponse.json(
        {
          error: "Las estadísticas requieren un plan de pago",
          code: "STATISTICS_LIMIT_EXCEEDED",
        },
        { status: 403 },
      );
    const cached = await readStatisticsReport(owner);
    if (
      !body.refresh &&
      cached &&
      Date.now() - new Date(cached.generated_at).getTime() < 30 * 60000
    )
      return NextResponse.json(
        { ...cached.report, generatedAt: cached.generated_at, cached: true },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    const reservation = await reserveUsage(owner, "statisticsAccess");
    if (!reservation.allowed)
      return NextResponse.json(
        {
          error: reservation.busy
            ? "Ya se está generando un informe. Inténtalo en unos segundos."
            : "Límite mensual de estadísticas alcanzado",
          code: reservation.busy
            ? "REPORT_IN_PROGRESS"
            : "STATISTICS_LIMIT_EXCEEDED",
          currentUsage: reservation.currentUsage,
        },
        { status: reservation.busy ? 409 : 429 },
      );
    if (!reservation.id) throw new Error("Reserva no disponible");
    reservationId = reservation.id;
    const report = await generateStatisticsReport(owner);
    // Report persistence and quota completion form a single database transaction.
    const { error } = await getDatabaseClient().rpc(
      "complete_statistics_report",
      { p_user_id: owner, p_id: reservationId, p_report: report },
    );
    if (error) throw error;
    reservationId = undefined;
    return NextResponse.json(
      { ...report, generatedAt: new Date().toISOString(), cached: false },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (owner && reservationId) {
      try {
        await finishUsage(owner, reservationId, false);
      } catch {
        /* Expired holds are reclaimed by reserve_usage. */
      }
    }
    console.error("Statistics report failed");
    return NextResponse.json(
      { error: "No se pudo generar el informe. Puedes reintentarlo." },
      { status: 500 },
    );
  }
}
