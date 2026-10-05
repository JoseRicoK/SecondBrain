import { APP_URL } from "./site";
export type PlanId = "free" | "pro" | "elite";
export type Limits = {
  personalChatMessages: number;
  personChatMessages: number;
  statisticsAccess: number;
};
export type Catalog = {
  checkoutEnabled: boolean;
  verified: boolean;
  limits: Record<PlanId, Limits>;
};
export const FALLBACK_CATALOG: Catalog = {
  checkoutEnabled: false,
  verified: false,
  limits: {
    free: {
      personalChatMessages: 5,
      personChatMessages: 10,
      statisticsAccess: 0,
    },
    pro: {
      personalChatMessages: 30,
      personChatMessages: 100,
      statisticsAccess: 10,
    },
    elite: {
      personalChatMessages: 100,
      personChatMessages: 500,
      statisticsAccess: -1,
    },
  },
};
export function parseCatalog(value: unknown): Catalog | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const limits = data.limits as Catalog["limits"] | undefined;
  if (!limits || typeof data.checkoutEnabled !== "boolean") return null;
  for (const id of ["free", "pro", "elite"] as const) {
    const plan = limits[id];
    if (!plan) return null;
    for (const key of [
      "personalChatMessages",
      "personChatMessages",
      "statisticsAccess",
    ] as const) {
      if (!Number.isSafeInteger(plan[key]) || plan[key] < -1) return null;
    }
  }
  return { limits, checkoutEnabled: data.checkoutEnabled, verified: true };
}
export async function getCatalog(): Promise<Catalog> {
  // Test builds cannot access production services.
  if (process.env.SECOND_BRAIN_TEST_BUILD === "1")
    return { ...FALLBACK_CATALOG, verified: true };
  try {
    const response = await fetch(APP_URL + "/api/subscription/plans", {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const catalog = parseCatalog(await response.json());
      if (catalog) return catalog;
    }
  } catch {
    /* Keep registration available when the catalog is unavailable. */
  }
  return FALLBACK_CATALOG;
}
