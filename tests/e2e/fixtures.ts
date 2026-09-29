import { PLAN_LIMITS } from "../../secondbrain/src/lib/subscription-policy";
import { test as base, expect, type Page } from "@playwright/test";
export { expect };
export const uid = "32985906-abdf-477d-8ef3-84bba3b80c25";
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const fixtureUser = {
  id: uid,
  aud: "authenticated",
  role: "authenticated",
  email: "ana@test.invalid",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { display_name: "Ana Pruebas" },
  created_at: "2026-01-01T00:00:00Z",
};
const token = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: uid, aud: "authenticated", exp: 4102444800, role: "authenticated" })).toString("base64url")}.fixture`;
export const session = {
  access_token: token,
  refresh_token: "fixture-refresh",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: 4102444800,
  user: fixtureUser,
};
export async function signIn(page: Page) {
  await page.addInitScript((value) => {
    if (!sessionStorage.getItem("fixture-seeded")) {
      localStorage.setItem("sb-fixtures-auth-token", JSON.stringify(value));
      sessionStorage.setItem("fixture-seeded", "true");
    }
  }, session);
}
export type Backend = {
  tables: Record<string, any[]>;
  calls: { path: string; method: string; body: any }[];
  failSave: boolean;
  aiError: boolean;
  limit: boolean;
  emailError: boolean;
};
export const test = base.extend<{ backend: Backend }>({
  backend: async ({ page }, use) => {
    const date = today();
    const user = structuredClone(fixtureUser);
    const backend: Backend = {
      calls: [],
      failSave: false,
      aiError: false,
      limit: false,
      emailError: false,
      tables: {
        profiles: [
          {
            uid,
            email: fixtureUser.email,
            display_name: "Ana Pruebas",
            is_google_user: false,
            is_first_login: false,
            has_completed_first_payment: false,
            show_welcome_modal: false,
            created_at: fixtureUser.created_at,
            last_login_at: fixtureUser.created_at,
            subscription: {
              plan: "pro",
              status: "active",
              createdAt: fixtureUser.created_at,
              updatedAt: fixtureUser.created_at,
              monthlyUsage: {
                personalChatMessages: 2,
                personChatMessages: 3,
                statisticsAccess: 1,
                month: date.slice(0, 7),
                lastUpdated: fixtureUser.created_at,
              },
            },
          },
        ],
        diary_entries: [
          {
            id: "entry-fixture",
            user_id: uid,
            date,
            content: "Hoy paseé con Ana por el parque.",
            mentioned_people: ["Ana"],
            created_at: `${date}T12:00:00Z`,
            updated_at: `${date}T12:00:00Z`,
            happiness: 80,
            stress: 10,
            tranquility: 70,
            sadness: 0,
          },
        ],
        people: [
          {
            id: "person-fixture",
            user_id: uid,
            name: "Ana",
            mention_count: 3,
            created_at: fixtureUser.created_at,
            updated_at: fixtureUser.created_at,
            details: {
              rol: { entries: [{ value: "Amiga", date: "2026-01-01" }] },
              gustos: { entries: [{ value: "Leer", date: "2026-01-01" }] },
            },
          },
          {
            id: "person-other",
            user_id: uid,
            name: "Luis",
            mention_count: 1,
            created_at: fixtureUser.created_at,
            updated_at: fixtureUser.created_at,
            details: {},
          },
        ],
        audio_transcriptions: [],
        mood_data: [],
      },
    };
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const method = req.method();
      if (
        !["127.0.0.1", "localhost", "fixtures.supabase.co"].includes(
          url.hostname,
        )
      )
        return route.abort("blockedbyclient");
      const respond = (data: any, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      if (url.hostname === "fixtures.supabase.co") {
        const body = req.postData() ? JSON.parse(req.postData()!) : null;
        backend.calls.push({ path: url.pathname, method, body });
        if (url.pathname.startsWith("/auth/")) {
          if (url.pathname.endsWith("/token")) return respond(session);
          if (url.pathname.endsWith("/user")) {
            if (method === "PUT")
              Object.assign(user.user_metadata, body.data || {});
            return respond(user);
          }
          if (url.pathname.endsWith("/signup"))
            return respond({
              user: { ...fixtureUser, email_confirmed_at: null },
              session: null,
            });
          if (url.pathname.endsWith("/logout"))
            return route.fulfill({ status: 204 });
          return respond({});
        }
        const table = url.pathname.split("/").at(-1)!;
        const rows = backend.tables[table];
        if (!rows)
          return respond({ error: `Unknown fixture table ${table}` }, 500);
        const matches = (row: any) =>
          Array.from(url.searchParams.entries()).every(([key, filter]) => {
            if (["select", "order", "limit", "on_conflict"].includes(key))
              return true;
            const [op, ...rest] = filter.split(".");
            const value = rest.join(".");
            return op === "eq"
              ? String(row[key]) === value
              : op === "gte"
                ? row[key] >= value
                : op === "lte"
                  ? row[key] <= value
                  : true;
          });
        let selected = rows.filter(matches);
        if (["POST", "PATCH", "DELETE"].includes(method)) {
          if (backend.failSave && table === "diary_entries")
            return respond(
              { message: "Fixture save failed", code: "42501" },
              403,
            );
          if (method === "PATCH") {
            selected.forEach((row) => Object.assign(row, body));
          }
          if (method === "POST") {
            const inserted = {
              id: `${table}-${rows.length + 1}`,
              created_at: new Date().toISOString(),
              ...body,
            };
            rows.push(inserted);
            selected = [inserted];
          }
          if (method === "DELETE") {
            backend.tables[table] = rows.filter((row) => !matches(row));
            selected = [];
          }
        }
        if (req.headers().accept?.includes("vnd.pgrst.object+json"))
          return respond(selected[0] || null);
        return respond(selected);
      }
      if (url.pathname === "/api/subscription/plans") {
        backend.calls.push({ path: url.pathname, method, body: null });
        return respond({
          free: null,
          pro: null,
          elite: null,
          limits: PLAN_LIMITS,
          checkoutEnabled: false,
        });
      }
      if (url.pathname.startsWith("/api/") && req.headers().authorization) {
        let body: any = {};
        try {
          body = req.postDataJSON();
        } catch {}
        backend.calls.push({ path: url.pathname, method, body });
        if (url.pathname === "/api/subscription/status")
          return respond({
            subscription: backend.tables.profiles[0].subscription,
            isFirstLogin: false,
            currentPlan: backend.tables.profiles[0].subscription.plan,
            planLimits:
              PLAN_LIMITS[
                backend.tables.profiles[0].subscription
                  .plan as keyof typeof PLAN_LIMITS
              ],
            monthlyUsage: backend.tables.profiles[0].subscription.monthlyUsage,
            resetAt: new Date(
              new Date().getFullYear(),
              new Date().getMonth() + 1,
              1,
            ).toISOString(),
            needsUpgrade: false,
          });
        if (url.pathname === "/api/stylize")
          return backend.aiError
            ? respond({ error: "IA no disponible" }, 500)
            : respond({ stylizedText: "Texto mejorado sin perder tu voz." });
        if (url.pathname === "/api/extract-people")
          return respond({
            peopleExtracted: [{ name: "Ana", information: { rol: "Amiga" } }],
            totalPeopleProcessed: 1,
            moodAnalysis: {
              happiness: 80,
              stress: 10,
              tranquility: 70,
              sadness: 0,
            },
          });
        if (url.pathname === "/api/transcribe")
          return backend.aiError
            ? respond({ error: "Audio no disponible" }, 500)
            : respond({
                text: "Una reflexión grabada.",
                audioUrl: "data:audio/wav;base64,AA==",
              });
        if (
          url.pathname === "/api/personal-chat" ||
          url.pathname === "/api/chat-person"
        )
          return backend.limit
            ? respond(
                { error: "Límite alcanzado", code: "LIMIT_EXCEEDED" },
                429,
              )
            : backend.aiError
              ? respond({ error: "IA no disponible" }, 500)
              : (backend.tables.profiles[0].subscription.monthlyUsage[
                  url.pathname === "/api/personal-chat"
                    ? "personalChatMessages"
                    : "personChatMessages"
                ]++,
                respond({
                  response: "Puedes reflexionar sobre tus relaciones.",
                  entriesAnalyzed: 1,
                }));
        if (
          url.pathname === "/api/statistics/report" ||
          url.pathname === "/api/statistics/access"
        ) {
          if (backend.tables.profiles[0].subscription.plan === "free")
            return respond(
              {
                error: "Las estadísticas requieren un plan de pago",
                code: "STATISTICS_LIMIT_EXCEEDED",
              },
              403,
            );
          if (backend.limit)
            return respond(
              {
                error: "Límite de estadísticas alcanzado",
                code: "STATISTICS_LIMIT_EXCEEDED",
              },
              429,
            );
          backend.tables.profiles[0].subscription.monthlyUsage
            .statisticsAccess++;
          return respond({
            weekSummary: "Has dedicado tiempo a tus amistades.",
            instagramQuote: "Cada día es una oportunidad.",
            topPeople: [{ name: "Ana", count: 3 }],
            moodData: [
              { date, happiness: 80, stress: 10, tranquility: 70, sadness: 0 },
            ],
          });
        }
        if (url.pathname === "/api/statistics/summary")
          return respond({
            weekSummary: "Has dedicado tiempo a tus amistades.",
          });
        if (url.pathname === "/api/statistics/quote")
          return respond({ instagramQuote: "Cada día es una oportunidad." });
        if (url.pathname === "/api/statistics/people")
          return respond({ topPeople: [{ name: "Ana", count: 3 }] });
        if (url.pathname === "/api/statistics/mood")
          return respond({
            moodData: [
              { date, happiness: 80, stress: 10, tranquility: 70, sadness: 0 },
            ],
          });
        if (url.pathname === "/api/send-feedback")
          return respond(
            { success: !backend.emailError },
            backend.emailError ? 500 : 200,
          );
        if (url.pathname === "/api/account") return respond({ success: true });
        if (url.pathname === "/api/stripe/cancel-subscription")
          return respond({
            success: true,
            cancelAt: "2026-12-31",
            message: "Cancelación programada",
          });
        return respond({ error: `Unhandled fixture API ${url.pathname}` }, 500);
      }
      return route.continue();
    });
    await use(backend);
    expect(errors, "browser runtime errors").toEqual([]);
  },
});
export async function openSidebar(page: Page) {
  const trigger = page.getByRole("button", {
    name: "Open sidebar",
    includeHidden: true,
  });
  await trigger.waitFor({ state: "attached" });
  if (await trigger.isVisible()) await trigger.click();
}
export async function noHorizontalOverflow(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        ),
      { message: "Horizontal page overflow", timeout: 5000 },
    )
    .toBeLessThanOrEqual(1);
}
