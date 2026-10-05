import {
  buildDiaryAnalytics,
  analyticsRange,
  entryMoodValues,
  type AnalyticsPeriod,
  type MoodKey,
} from "../../secondbrain/src/lib/diary-analytics";
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
  feedbackError: boolean;
  reanalysisDelay: number;
  usage: {
    personalChatMessages: number;
    personChatMessages: number;
    statisticsAccess: number;
    month: string;
    lastUpdated: string;
  };
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
      feedbackError: false,
      reanalysisDelay: 0,
      usage: {
        personalChatMessages: 2,
        personChatMessages: 3,
        statisticsAccess: 1,
        month: date.slice(0, 7),
        lastUpdated: fixtureUser.created_at,
      },
      tables: {
        reanalysis_jobs: [],
        profiles: [
          {
            uid,
            admin: false,
            email: fixtureUser.email,
            display_name: "Ana Pruebas",
            is_google_user: false,
            is_first_login: false,
            has_completed_first_payment: false,
            show_welcome_modal: false,
            created_at: fixtureUser.created_at,
            last_login_at: fixtureUser.created_at,
          },
        ],
        subscriptions: [
          {
            user_id: uid,
            plan: "pro",
            status: "active",
            created_at: fixtureUser.created_at,
            updated_at: fixtureUser.created_at,
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
        feedback_reports: [],
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
        if (
          table === "profiles" &&
          url.searchParams.get("select")?.includes("subscriptions")
        )
          selected = selected.map((row) => ({
            ...row,
            subscriptions:
              backend.tables.subscriptions.find(
                (subscription) => subscription.user_id === row.uid,
              ) || null,
          }));
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
            subscription: {
              ...backend.tables.subscriptions[0],
              createdAt: backend.tables.subscriptions[0].created_at,
              updatedAt: backend.tables.subscriptions[0].updated_at,
            },
            isFirstLogin: false,
            currentPlan: backend.tables.subscriptions[0].plan,
            planLimits:
              PLAN_LIMITS[
                backend.tables.subscriptions[0].plan as keyof typeof PLAN_LIMITS
              ],
            monthlyUsage: backend.usage,
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
              neutral: 15,
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
              : (backend.usage[
                  url.pathname === "/api/personal-chat"
                    ? "personalChatMessages"
                    : "personChatMessages"
                ]++,
                respond({
                  response: "Puedes reflexionar sobre tus relaciones.",
                  entriesAnalyzed: 1,
                }));
        if (url.pathname === "/api/statistics/person-emotions") {
          if (backend.tables.subscriptions[0].plan === "free")
            return respond({ error: "Plan de pago requerido" }, 403);
          const emotion = url.searchParams.get("emotion") as MoodKey;
          const person = url.searchParams.get("person");
          const range = analyticsRange(
            (url.searchParams.get("period") as AnalyticsPeriod) || "all",
            date,
          );
          const cursor = url.searchParams.get("cursor")?.split("|");
          const ranked = backend.tables.diary_entries
            .filter(
              (entry) =>
                entry.user_id === uid &&
                entry.content.trim() &&
                entry.date <= date &&
                (!range.start || entry.date >= range.start) &&
                entry.mentioned_people.includes(person) &&
                entryMoodValues(entry)[emotion] !== null,
            )
            .map((entry) => ({ date: entry.date, ...entryMoodValues(entry) }))
            .filter(
              (entry) =>
                !cursor ||
                entry[emotion]! < Number(cursor[0]) ||
                (entry[emotion] === Number(cursor[0]) &&
                  entry.date < cursor[1]),
            )
            .sort(
              (a, b) =>
                b[emotion]! - a[emotion]! || b.date.localeCompare(a.date),
            );
          const entries = ranked.slice(0, 12);
          const last = entries.at(-1);
          return respond({
            entries,
            nextCursor:
              ranked.length > 12 && last
                ? `${last[emotion]}|${last.date}`
                : null,
          });
        }
        if (url.pathname === "/api/statistics/connections") {
          if (backend.tables.subscriptions[0].plan === "free")
            return respond({ error: "Plan de pago requerido" }, 403);
          const dates = (url.searchParams.get("dates") || "").split(",");
          const source = url.searchParams.get("source");
          const target = url.searchParams.get("target");
          return respond({
            entries: backend.tables.diary_entries
              .filter(
                (entry) =>
                  entry.user_id === uid &&
                  dates.includes(entry.date) &&
                  entry.mentioned_people.includes(source) &&
                  entry.mentioned_people.includes(target),
              )
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 12)
              .map((entry) => ({
                date: entry.date,
                excerpt: entry.content.slice(0, 200),
                ...entryMoodValues(entry),
              })),
          });
        }
        if (url.pathname === "/api/statistics/analytics") {
          if (backend.tables.subscriptions[0].plan === "free")
            return respond({ error: "Plan de pago requerido" }, 403);
          return respond({
            analytics: buildDiaryAnalytics(
              backend.tables.diary_entries.filter(
                (entry) => entry.user_id === uid,
              ),
              (url.searchParams.get("period") as AnalyticsPeriod) || "all",
              date,
            ),
            report: {
              weekSummary: "Has dedicado tiempo a tus amistades.",
              instagramQuote: "Cada día es una oportunidad.",
              generatedAt: new Date().toISOString(),
            },
          });
        }
        if (
          url.pathname === "/api/statistics/report" ||
          url.pathname === "/api/statistics/access"
        ) {
          if (backend.tables.subscriptions[0].plan === "free")
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
          backend.usage.statisticsAccess++;
          return respond({
            generatedAt: new Date().toISOString(),
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
        if (url.pathname === "/api/send-feedback") {
          if (backend.feedbackError)
            return respond(
              { error: "No se pudo guardar tu mensaje. Inténtalo de nuevo." },
              503,
            );
          const record = {
            id: "11111111-1111-4111-8111-111111111111",
            user_id: uid,
            type: body.type,
            message: body.message,
            status: "open",
            priority: "normal",
            admin_notes: "",
            email: user.email,
            display_name: backend.tables.profiles[0].display_name,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          backend.tables.feedback_reports.push(record);
          return respond({
            success: true,
            saved: true,
            id: record.id,
            notified: !backend.emailError,
          });
        }
        if (url.pathname.startsWith("/api/dashboard/")) {
          if (backend.tables.profiles[0].admin !== true)
            return respond(
              { error: "Esta pantalla está reservada a administradores" },
              403,
            );
          if (url.pathname.endsWith("/reanalysis")) {
            const rows = backend.tables.diary_entries.filter(
              (row) => row.user_id === uid && row.content?.trim(),
            );
            let job = backend.tables.reanalysis_jobs[0] || null;
            if (method === "GET")
              return respond({
                eligible: rows.length,
                peoplePending: rows.filter((row) => !row.mood_analyzed_at)
                  .length,
                job,
              });
            if (body.action === "start") {
              if (!job || job.status !== "running") {
                job = {
                  id: "55555555-5555-4555-8555-555555555555",
                  userId: uid,
                  status: "running",
                  total: rows.length,
                  done: 0,
                  failed: 0,
                  skipped: 0,
                  pending: rows.length,
                  peoplePending: rows.filter((row) => !row.mood_analyzed_at)
                    .length,
                  inFlight: false,
                  createdAt: new Date().toISOString(),
                  issues: [],
                };
                backend.tables.reanalysis_jobs = [job];
              }
            } else if (
              body.action === "process" &&
              job &&
              job.status === "running"
            ) {
              if (backend.reanalysisDelay)
                await new Promise((resolve) =>
                  setTimeout(resolve, backend.reanalysisDelay),
                );
              const row = rows[job.done];
              if (row)
                Object.assign(row, {
                  happiness: 0,
                  tranquility: null,
                  stress: 0,
                  sadness: 0,
                  neutral: 90,
                  mood_analyzed_at: new Date().toISOString(),
                });
              job.done++;
              job.pending--;
              job.peoplePending = Math.max(0, job.peoplePending - 1);
              if (!job.pending) job.status = "completed";
            } else if (body.action === "cancel" && job) {
              job.skipped += job.pending;
              job.pending = 0;
              job.status = "canceled";
            }
            return respond({ job });
          }
          if (url.pathname.endsWith("/overview"))
            return respond({
              users: 1,
              admins: 1,
              missingProfiles: 0,
              newUsers30: 1,
              activeUsers30: 1,
              entries: 1,
              people: 2,
              transcriptions: 0,
              analysedEntries: 1,
              reports: 0,
              plans: { pro: 1 },
              subscriptionStates: { active: 1 },
              providerSubscriptions: 0,
              cancellations: 0,
              feedback: {
                open: backend.tables.feedback_reports.filter(
                  (row) => row.status === "open",
                ).length,
                resolved: backend.tables.feedback_reports.filter(
                  (row) => row.status === "resolved",
                ).length,
              },
              feedbackTypes: {
                problem: backend.tables.feedback_reports.filter(
                  (row) => row.type === "problem",
                ).length,
                suggestion: backend.tables.feedback_reports.filter(
                  (row) => row.type === "suggestion",
                ).length,
              },
              usage: {
                personalChatMessages: 2,
                personChatMessages: 3,
                statisticsAccess: 1,
              },
              pendingBillingEmails: 0,
              failedBillingEmails: 0,
              billingEvents30: 0,
              catalog: Object.entries(PLAN_LIMITS).map(([id, limits]) => ({
                id,
                personal_chat_messages: limits.personalChatMessages,
                person_chat_messages: limits.personChatMessages,
                statistics_access: limits.statisticsAccess,
              })),
              monthly: [
                { month: date.slice(0, 7) + "-01", users: 1, entries: 1 },
              ],
              generatedAt: new Date().toISOString(),
              usageMonth: date.slice(0, 7) + "-01",
              checkoutEnabled: false,
              billingEmailsEnabled: false,
            });
          if (url.pathname.endsWith("/users")) {
            const item = {
              ...backend.tables.profiles[0],
              ...backend.tables.subscriptions[0],
              effective_plan: backend.tables.subscriptions[0].plan,
              has_profile: true,
              email_confirmed: true,
              entries: 1,
              people: 2,
              lastEntry: date,
              usage: backend.usage,
            };
            if (url.searchParams.has("id"))
              return respond({
                ...item,
                transcriptions: 0,
                analysedEntries: 1,
                lastActivity: date,
                reportGeneratedAt: null,
                feedback: backend.tables.feedback_reports.length,
                usageHistory: [],
                billingEvents: [],
              });
            const query = (url.searchParams.get("q") || "").toLowerCase(),
              plan = url.searchParams.get("plan") || "all";
            const items =
              (!query ||
                (item.email + " " + item.display_name)
                  .toLowerCase()
                  .includes(query)) &&
              (plan === "all" || plan === item.effective_plan)
                ? [item]
                : [];
            return respond({
              items,
              total: items.length,
              page: 1,
              pageSize: 25,
            });
          }
          if (url.pathname.endsWith("/feedback")) {
            if (method === "PATCH") {
              const record = backend.tables.feedback_reports.find(
                (row) => row.id === body.id,
              );
              if (!record) return respond({ error: "No encontrado" }, 404);
              Object.assign(record, {
                status: body.status,
                priority: body.priority,
                admin_notes: body.notes,
                updated_at: new Date().toISOString(),
              });
              return respond({ saved: true });
            }
            const type = url.searchParams.get("type") || "all",
              status = url.searchParams.get("status") || "all",
              query = (url.searchParams.get("q") || "").toLowerCase();
            const items = backend.tables.feedback_reports.filter(
              (row) =>
                (type === "all" || row.type === type) &&
                (status === "all" || row.status === status) &&
                (!query ||
                  (row.message + " " + row.email + " " + row.display_name)
                    .toLowerCase()
                    .includes(query)),
            );
            return respond({
              items,
              total: items.length,
              page: 1,
              pageSize: 20,
            });
          }
        }
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
