import {
  requireDashboardAdmin,
  dashboardJson,
  dashboardFailure,
  listFilters,
  validUuid,
} from "@/lib/dashboard-auth";
import { feedbackStatuses, feedbackPriorities } from "@/lib/dashboard-types";
export async function GET(request: Request) {
  try {
    const access = await requireDashboardAdmin(request);
    if (access.response) return access.response;
    const filters = listFilters(request);
    if (!filters) return dashboardJson({ error: "Filtros no válidos" }, 400);
    const type = filters.params.get("type") || "all",
      status = filters.params.get("status") || "all";
    if (
      !["all", "suggestion", "problem"].includes(type) ||
      !["all", ...Object.keys(feedbackStatuses)].includes(status)
    )
      return dashboardJson({ error: "Filtros no válidos" }, 400);
    const { data, error } = await access.database.rpc("admin_feedback", {
      p_actor: access.user.uid,
      p_query: filters.query,
      p_type: type,
      p_status: status,
      p_page: filters.page,
    });
    return error || !data ? dashboardFailure(error) : dashboardJson(data);
  } catch {
    return dashboardFailure();
  }
}
export async function PATCH(request: Request) {
  try {
    const access = await requireDashboardAdmin(request);
    if (access.response) return access.response;
    let body;
    try {
      body = await request.json();
    } catch {
      return dashboardJson({ error: "Formato no válido" }, 400);
    }
    if (
      !body ||
      !validUuid(body.id) ||
      !Object.hasOwn(feedbackStatuses, body.status) ||
      !Object.hasOwn(feedbackPriorities, body.priority) ||
      typeof body.notes !== "string" ||
      body.notes.length > 5000 ||
      typeof body.version !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T/.test(body.version) ||
      !Number.isFinite(Date.parse(body.version))
    )
      return dashboardJson({ error: "Datos no válidos" }, 400);
    const { data, error } = await access.database.rpc("admin_update_feedback", {
      p_actor: access.user.uid,
      p_id: body.id,
      p_status: body.status,
      p_priority: body.priority,
      p_notes: body.notes,
      p_version: body.version,
    });
    if (error || !data) return dashboardFailure(error);
    if (data.missing)
      return dashboardJson({ error: "Reporte no encontrado" }, 404);
    if (data.conflict)
      return dashboardJson(
        {
          error:
            "Otro administrador ha cambiado este reporte. Recárgalo antes de guardar.",
        },
        409,
      );
    return dashboardJson(data);
  } catch {
    return dashboardFailure();
  }
}
