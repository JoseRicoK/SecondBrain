import {
  requireDashboardAdmin,
  dashboardJson,
  dashboardFailure,
  validUuid,
} from "@/lib/dashboard-auth";
import { processReanalysis } from "@/lib/diary-reanalysis";
export const maxDuration = 240;
export async function GET(request: Request) {
  try {
    const access = await requireDashboardAdmin(request);
    if (access.response) return access.response;
    const id = new URL(request.url).searchParams.get("userId");
    if (!validUuid(id))
      return dashboardJson({ error: "Usuario no válido" }, 400);
    const { data, error } = await access.database.rpc(
      "admin_reanalysis_status",
      { p_actor: access.user.uid, p_user_id: id },
    );
    if (error) return dashboardFailure(error);
    return data
      ? dashboardJson(data)
      : dashboardJson({ error: "Usuario no encontrado" }, 404);
  } catch {
    return dashboardFailure();
  }
}
export async function POST(request: Request) {
  try {
    const access = await requireDashboardAdmin(request);
    if (access.response) return access.response;
    const body = await request.json().catch(() => null);
    if (!body || !["start", "process", "retry", "cancel"].includes(body.action))
      return dashboardJson({ error: "Acción no válida" }, 400);
    if (body.action === "start") {
      if (!validUuid(body.userId) || !validUuid(body.requestId))
        return dashboardJson({ error: "Usuario o solicitud no válidos" }, 400);
      const { data, error } = await access.database.rpc(
        "admin_start_reanalysis",
        {
          p_actor: access.user.uid,
          p_user_id: body.userId,
          p_request_id: body.requestId,
        },
      );
      if (error) return dashboardFailure(error);
      return data
        ? dashboardJson({ job: data })
        : dashboardJson({ error: "Usuario no encontrado" }, 404);
    }
    if (!validUuid(body.jobId))
      return dashboardJson({ error: "Proceso no válido" }, 400);
    if (body.action === "process") {
      const result = await processReanalysis(
        access.database,
        access.user.uid,
        body.jobId,
      );
      return result
        ? dashboardJson(result)
        : dashboardJson({ error: "Proceso no encontrado" }, 404);
    }
    const { data, error } = await access.database.rpc(
      "admin_control_reanalysis",
      { p_actor: access.user.uid, p_job_id: body.jobId, p_action: body.action },
    );
    if (error) return dashboardFailure(error);
    return data
      ? dashboardJson({ job: data })
      : dashboardJson({ error: "Proceso no encontrado" }, 404);
  } catch (error) {
    return dashboardFailure(error as { code?: string });
  }
}
