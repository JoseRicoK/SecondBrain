import { NextResponse } from "next/server";
import { getRequestUser } from "./api-auth";
import { getDatabaseClient } from "./supabase";
export const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Authorization",
};
export function dashboardJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: privateHeaders });
}
export async function requireDashboardAdmin(request: Request) {
  const user = await getRequestUser(request);
  if (!user)
    return {
      response: dashboardJson({ error: "Debes iniciar sesión" }, 401),
    } as const;
  const database = getDatabaseClient();
  const { data, error } = await database
    .from("profiles")
    .select("admin")
    .eq("uid", user.uid)
    .maybeSingle();
  if (error) throw new Error("Admin permission unavailable");
  if (data?.admin !== true)
    return {
      response: dashboardJson(
        { error: "Esta pantalla está reservada a administradores" },
        403,
      ),
    } as const;
  return { user, database } as const;
}
export function dashboardFailure(error?: { code?: string } | null) {
  if (error?.code === "42501")
    return dashboardJson(
      { error: "Tu cuenta no tiene permisos de administrador" },
      403,
    );
  return dashboardJson(
    { error: "No se pudo cargar el panel. Inténtalo de nuevo." },
    503,
  );
}
export const validUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function listFilters(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") || "").trim();
  const rawPage = params.get("page") || "1";
  if (
    query.length > 100 ||
    !/^[1-9]\d{0,5}$/.test(rawPage) ||
    Number(rawPage) > 100000
  )
    return null;
  return { query, page: Number(rawPage), params };
}
