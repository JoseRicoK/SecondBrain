import {
  requireDashboardAdmin,
  dashboardJson,
  dashboardFailure,
  listFilters,
  validUuid,
} from "@/lib/dashboard-auth";
export async function GET(request: Request) {
  try {
    const access = await requireDashboardAdmin(request);
    if (access.response) return access.response;
    const filters = listFilters(request);
    if (!filters) return dashboardJson({ error: "Filtros no válidos" }, 400);
    const id = filters.params.get("id");
    if (id !== null) {
      if (!validUuid(id))
        return dashboardJson({ error: "Usuario no válido" }, 400);
      const { data, error } = await access.database.rpc("admin_user_detail", {
        p_actor: access.user.uid,
        p_user_id: id,
      });
      if (error) return dashboardFailure(error);
      return data
        ? dashboardJson(data)
        : dashboardJson({ error: "Usuario no encontrado" }, 404);
    }
    const plan = filters.params.get("plan") || "all";
    if (!["all", "free", "pro", "elite"].includes(plan))
      return dashboardJson({ error: "Plan no válido" }, 400);
    const { data, error } = await access.database.rpc("admin_users", {
      p_actor: access.user.uid,
      p_query: filters.query,
      p_plan: plan,
      p_page: filters.page,
    });
    if (error || !data) return dashboardFailure(error);
    return dashboardJson(data);
  } catch {
    return dashboardFailure();
  }
}
