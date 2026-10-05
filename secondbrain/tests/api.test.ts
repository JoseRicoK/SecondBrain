import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import Stripe from "stripe";
import { mockDatabase } from "./helpers/database";

const mock = vi.hoisted(() => {
  const functions = (names: string[]) =>
    Object.fromEntries(names.map((name) => [name, vi.fn()]));
  return {
    auth: functions(["getAuthenticatedUser", "getRequestUser"]),
    data: functions([
      "getDiaryEntriesByUserId",
      "getEntriesByDateRange",
      "getPeopleByUserId",
      "getPersonByIdForUser",
      "getEntriesMoodDataByDateRange",
      "getEntryByIdForUser",
      "saveExtractedPersonInfo",
      "updateEntryMoodData",
    ]),
    subscriptions: functions([
      "getUserProfile",
      "createUserProfile",
      "updateUserSubscription",
      "getUserMonthlyUsage",
      "reserveUsage",
      "finishUsage",
      "incrementPersonalChatUsage",
      "incrementPersonChatUsage",
      "incrementStatisticsAccess",
      "markFirstPaymentComplete",
      "findUserByStripeCustomerId",
    ]),
    policy: functions([
      "canSendPersonalChatMessage",
      "canSendPersonChatMessage",
      "canAccessStatistics",
    ]),
    snapshot: vi.fn(),
    responses: vi.fn(),
    chat: vi.fn(),
    transcription: vi.fn(),
    sendEmail: vi.fn(),
    database: vi.fn(),
    deleteUser: vi.fn(),
    client: vi.fn(),
    enabled: vi.fn(),
    schema: vi.fn(),
    attempts: {
      claim: vi.fn(),
      register: vi.fn(),
      read: vi.fn(),
      release: vi.fn(),
    },
    stripe: {
      prices: { retrieve: vi.fn() },
      customers: { create: vi.fn(), retrieve: vi.fn(), del: vi.fn() },
      billingPortal: { sessions: { create: vi.fn() } },
      checkout: {
        sessions: {
          create: vi.fn(),
          retrieve: vi.fn(),
          list: vi.fn(),
          expire: vi.fn(),
        },
      },
      subscriptions: { update: vi.fn(), retrieve: vi.fn(), list: vi.fn() },
      webhooks: { constructEvent: vi.fn() },
      invoices: { retrieve: vi.fn() },
    },
  };
});
vi.mock("@/lib/checkout-attempts", () => ({
  claimCheckoutAttempt: mock.attempts.claim,
  registerCheckoutSession: mock.attempts.register,
  readCheckoutAttempt: mock.attempts.read,
  releaseCheckoutAttempt: mock.attempts.release,
}));
vi.mock("@/lib/billing-readiness", () => ({
  hasBillingSchema: mock.schema,
}));
vi.mock("@/lib/api-auth", () => mock.auth);
vi.mock("@/lib/subscription-snapshot", () => ({
  getSubscriptionSnapshot: mock.snapshot,
}));
vi.mock("@/lib/supabase-operations", () => mock.data);
vi.mock("@/lib/subscription-operations", () => mock.subscriptions);
vi.mock("@/middleware/subscription", () => mock.policy);
vi.mock("@/lib/supabase", () => ({ getDatabaseClient: mock.database }));
vi.mock("@/lib/stripe-server", () => ({
  getStripeClient: mock.client,
  isCheckoutEnabled: mock.enabled,
  getBillingOrigin: () => "http://localhost:3100",
}));
vi.mock("openai", () => ({
  default: class {
    responses = { create: mock.responses };
    chat = { completions: { create: mock.chat } };
    audio = { transcriptions: { create: mock.transcription } };
  },
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mock.sendEmail };
  },
}));

const modules = import.meta.glob("../src/app/api/**/route.ts");
const load = async (path: string): Promise<any> =>
  modules[`../src/app/api/${path}/route.ts`]();
const request = (
  path: string,
  body: any = {},
  method = "POST",
  headers: Record<string, string> = {},
) =>
  new NextRequest(`http://localhost:3100/api/${path}`, {
    method,
    headers: {
      authorization: "Bearer fixture-token",
      ...(method === "POST" ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
const invoke = async (path: string, body: any = {}, method = "POST") =>
  (await load(path))[method](request(path, body, method));
const db = mockDatabase();
const profile = (plan = "pro", extra = {}) => ({
  uid: "u",
  subscription: {
    plan,
    status: "active",
    stripeSubscriptionId: "sub_test",
    stripeCustomerId: "cus_test",
    ...extra,
  },
  isFirstLogin: false,
});
const usage = {
  personalChatMessages: 2,
  personChatMessages: 3,
  statisticsAccess: 4,
};
const subscription = {
  id: "sub_test",
  customer: "cus_test",
  status: "active",
  latest_invoice: { id: "in_test", status: "paid" },
  metadata: { uid: "u" },
  cancel_at_period_end: false,
  items: {
    data: [{ current_period_end: 1800000000, price: { id: "price_pro" } }],
  },
};
beforeEach(() => {
  for (const group of [mock.auth, mock.data, mock.subscriptions, mock.policy])
    for (const fn of Object.values(group)) fn.mockReset();
  for (const fn of [
    mock.responses,
    mock.chat,
    mock.transcription,
    mock.sendEmail,
    mock.deleteUser,
    mock.client,
    mock.enabled,
    mock.stripe.customers.create,
    mock.stripe.checkout.sessions.create,
    mock.stripe.checkout.sessions.retrieve,
    mock.stripe.subscriptions.update,
    mock.stripe.subscriptions.retrieve,
    mock.stripe.webhooks.constructEvent,
  ])
    fn.mockReset();
  db.reset();
  mock.data.getPersonByIdForUser.mockResolvedValue({
    id: "p",
    user_id: "u",
    name: "Ana",
    details: {},
  });
  mock.snapshot.mockReset();
  mock.snapshot.mockImplementation(async () => {
    const p = await mock.subscriptions.getUserProfile("u");
    if (!p) throw new Error("Profile not found");
    return {
      subscription: p.subscription,
      isFirstLogin: false,
      currentPlan: p.subscription.plan,
      planLimits: {
        hasStatistics: p.subscription.plan !== "free",
        statisticsAccess: 10,
      },
      monthlyUsage: usage,
    };
  });
  db.rpc.mockResolvedValue({ data: true, error: null });
  mock.subscriptions.reserveUsage.mockResolvedValue({
    allowed: true,
    id: "reservation",
    limit: 30,
    currentUsage: 2,
  });
  mock.stripe.invoices.retrieve.mockReset();
  mock.stripe.invoices.retrieve.mockResolvedValue({
    parent: { subscription_details: { subscription: "sub_test" } },
  });
  mock.database.mockReturnValue({
    ...db,
    auth: { admin: { deleteUser: mock.deleteUser } },
  });
  for (const fn of Object.values(mock.auth))
    fn.mockResolvedValue({ uid: "u", email: "u@test.invalid" });
  for (const name of [
    "getDiaryEntriesByUserId",
    "getEntriesByDateRange",
    "getPeopleByUserId",
    "getEntriesMoodDataByDateRange",
  ])
    mock.data[name].mockResolvedValue([]);
  mock.data.getEntryByIdForUser.mockResolvedValue({
    id: "e",
    user_id: "u",
    date: "2026-09-29",
  });
  mock.data.saveExtractedPersonInfo.mockResolvedValue({ id: "p" });
  mock.data.updateEntryMoodData.mockResolvedValue(true);
  mock.subscriptions.getUserProfile.mockResolvedValue(profile());
  mock.subscriptions.getUserMonthlyUsage.mockResolvedValue(usage);
  mock.subscriptions.findUserByStripeCustomerId.mockResolvedValue("u");
  for (const fn of Object.values(mock.policy)) fn.mockResolvedValue(true);
  mock.responses.mockResolvedValue({ output_text: "Texto de prueba" });
  mock.chat.mockResolvedValue({
    choices: [{ message: { content: "Respuesta de prueba" } }],
  });
  mock.transcription.mockResolvedValue({ text: "Transcripción de prueba" });
  mock.sendEmail.mockResolvedValue({ data: { id: "mail_test" }, error: null });
  mock.deleteUser.mockResolvedValue({ error: null });
  mock.client.mockReturnValue(mock.stripe);
  mock.enabled.mockReturnValue(true);
  mock.schema.mockResolvedValue(true);
  for (const fn of Object.values(mock.attempts)) fn.mockReset();
  mock.attempts.claim.mockImplementation(
    async (uid: string, id: string, plan: string) => ({
      requestId: id,
      plan,
      sessionId: null,
      expiresAt: new Date(Date.now() + 36 * 60 * 1000).toISOString(),
    }),
  );
  mock.attempts.register.mockResolvedValue(undefined);
  mock.attempts.read.mockResolvedValue(null);
  mock.attempts.release.mockResolvedValue(undefined);
  mock.stripe.subscriptions.list.mockResolvedValue({
    data: [],
    has_more: false,
  });
  mock.stripe.prices.retrieve.mockReset();
  mock.stripe.prices.retrieve.mockImplementation(async (id: string) => ({
    active: true,
    currency: "eur",
    unit_amount: id === "price_elite" ? 999 : 499,
    recurring: { interval: "month", interval_count: 1 },
  }));
  mock.stripe.billingPortal.sessions.create.mockReset();
  mock.stripe.billingPortal.sessions.create.mockResolvedValue({
    url: "https://billing.stripe.com/p/session/fixture",
  });
  mock.stripe.customers.create.mockResolvedValue({ id: "cus_test" });
  mock.stripe.customers.retrieve.mockResolvedValue({
    id: "cus_test",
    metadata: { uid: "u" },
  });
  mock.stripe.customers.del.mockResolvedValue({
    id: "cus_test",
    deleted: true,
  });
  mock.stripe.checkout.sessions.list.mockResolvedValue({
    data: [],
    has_more: false,
  });
  mock.stripe.checkout.sessions.expire.mockResolvedValue({ status: "expired" });
  mock.stripe.checkout.sessions.create.mockResolvedValue({
    id: "cs_test",
    url: "https://checkout.stripe.com/c/pay/cs_test",
  });
  mock.stripe.checkout.sessions.retrieve.mockResolvedValue({
    id: "cs_test",
    mode: "subscription",
    payment_status: "paid",
    metadata: { uid: "u", plan_type: "pro" },
    customer: "cus_test",
    subscription,
  });
  mock.stripe.subscriptions.update.mockResolvedValue(subscription);
  mock.stripe.subscriptions.retrieve.mockResolvedValue(subscription);
  for (const [key, value] of Object.entries({
    STRIPE_PRO_PRICE_ID: "price_pro",
    STRIPE_ELITE_PRICE_ID: "price_elite",
    STRIPE_WEBHOOK_SECRET: "whsec_fixture",
    CRON_SECRET: "cron_fixture",
    OPENAI_API_KEY: "test-openai",
    RESEND_API_KEY: "re_fixture",
  }))
    vi.stubEnv(key, value);
});

const privateRoutes = [
  ["personal-chat", "POST"],
  ["chat-person", "POST"],
  ["transcribe", "POST"],
  ["stylize", "POST"],
  ["extract-people", "POST"],
  ["send-feedback", "POST"],
  ["account", "POST"],
  ["stripe/cancel-checkout-session", "POST"],
  ["statistics/summary", "GET"],
  ["statistics/quote", "GET"],
  ["statistics/people", "GET"],
  ["statistics/mood", "GET"],
  ["statistics/analytics", "GET"],
  ["statistics/connections", "GET"],
  ["statistics/person-emotions", "GET"],
  ["statistics/access", "POST"],
  ["subscription/status", "GET"],
  ["subscription/status", "POST"],
  ["subscription/update-manual", "POST"],
  ["stripe/create-checkout-session", "POST"],
  ["stripe/cancel-subscription", "POST"],
  ["stripe/verify-payment", "POST"],
];
describe("all private route boundaries", () => {
  it.each(privateRoutes)(
    "%s %s rejects anonymous access before side effects",
    async (path, method) => {
      for (const fn of Object.values(mock.auth)) fn.mockResolvedValue(null);
      const result = await invoke(path, {}, method);
      expect(result.status).toBe(401);
      for (const fn of [
        mock.responses,
        mock.chat,
        mock.transcription,
        mock.sendEmail,
        mock.deleteUser,
        mock.subscriptions.updateUserSubscription,
        mock.stripe.checkout.sessions.create,
      ])
        expect(fn).not.toHaveBeenCalled();
    },
  );
  it.each([
    "personal-chat",
    "stylize",
    "extract-people",
    "statistics/access",
    "subscription/status",
    "subscription/update-manual",
    "stripe/create-checkout-session",
    "stripe/cancel-subscription",
    "stripe/verify-payment",
  ])("%s rejects impersonating another user", async (path) => {
    expect(
      (
        await invoke(path, {
          userId: "other",
          userEmail: "other@test.invalid",
          text: "Hola",
          message: "Hola",
          planType: "pro",
        })
      ).status,
    ).toBe(403);
    expect(mock.responses).not.toHaveBeenCalled();
    expect(mock.subscriptions.updateUserSubscription).not.toHaveBeenCalled();
  });
  it.each([
    "personal-chat",
    "chat-person",
    "stylize",
    "extract-people",
    "send-feedback",
    "subscription/update-manual",
    "stripe/create-checkout-session",
    "stripe/cancel-subscription",
    "stripe/verify-payment",
  ])("%s handles malformed JSON as an error", async (path) => {
    const req = new NextRequest(`http://localhost/api/${path}`, {
      method: "POST",
      body: "{broken",
      headers: { authorization: "Bearer fixture" },
    });
    const result = await (await load(path)).POST(req);
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(mock.responses).not.toHaveBeenCalled();
  });
});
describe("AI, audio and statistics", () => {
  it("person chat rejects a foreign person before reserving quota", async () => {
    mock.data.getPersonByIdForUser.mockResolvedValue(null);
    const result = await invoke("chat-person", {
      person: { id: "foreign", name: "Ana" },
      message: "Hola",
    });
    expect(result.status).toBe(404);
    expect(mock.data.getPersonByIdForUser).toHaveBeenCalledWith("foreign", "u");
    expect(mock.subscriptions.reserveUsage).not.toHaveBeenCalled();
    expect(mock.chat).not.toHaveBeenCalled();
  });
  it("person chat uses canonical server data rather than browser supplied facts", async () => {
    mock.data.getPersonByIdForUser.mockResolvedValue({
      id: "p",
      name: "Ana",
      details: {
        relacion: { entries: [{ value: "amiga", date: "2025-01-01" }] },
      },
    });
    expect(
      (
        await invoke("chat-person", {
          person: { id: "p", name: "Inventada", details: { rol: "Inventado" } },
          message: "Hola",
        })
      ).status,
    ).toBe(200);
    const context = mock.chat.mock.calls[0][0].messages[0].content;
    expect(context).toContain("amiga");
    expect(context).not.toContain("Inventado");
  });
  it.each(["2026-02-30", "invalid", "2025-13-01"])(
    "extraction rejects invalid calendar dates (%s)",
    async (entryDate) => {
      expect(
        (
          await invoke("extract-people", {
            userId: "u",
            text: "Hola",
            entryDate,
          })
        ).status,
      ).toBe(400);
      expect(mock.responses).not.toHaveBeenCalled();
    },
  );
  it("validates all people before saving any malformed model result", async () => {
    mock.responses.mockResolvedValue({
      output_text: JSON.stringify({
        people: [
          { name: "Ana", information: { relacion: "amiga" } },
          { name: "Otra", information: { detalles: [false] } },
        ],
      }),
    });
    expect(
      (
        await invoke("extract-people", {
          userId: "u",
          text: "Hola",
          entryDate: "2026-09-29",
        })
      ).status,
    ).toBe(500);
    expect(mock.data.saveExtractedPersonInfo).not.toHaveBeenCalled();
  });
  it("groups case variants and includes a known person even when no facts changed", async () => {
    mock.data.getPeopleByUserId.mockResolvedValue([
      { name: "Ana", details: {} },
    ]);
    mock.responses.mockResolvedValue({
      output_text: JSON.stringify({
        people: [
          { name: "ana", information: { relacion: null, detalles: [] } },
          { name: " Ana ", information: { relacion: null, detalles: [] } },
        ],
      }),
    });
    const result = await invoke("extract-people", {
      userId: "u",
      text: "Vi a Ana",
      entryDate: "2026-09-29",
    });
    expect(result.status).toBe(200);
    expect(mock.data.saveExtractedPersonInfo).toHaveBeenCalledExactlyOnceWith(
      "Ana",
      { detalles: [] },
      "u",
      "2026-09-29",
    );
    expect((await result.json()).totalPeopleProcessed).toBe(1);
  });
  it("does not treat a failed address book lookup as empty context", async () => {
    mock.data.getPeopleByUserId.mockRejectedValue(new Error("database down"));
    expect(
      (
        await invoke("extract-people", {
          userId: "u",
          text: "Hola",
          entryDate: "2026-09-29",
        })
      ).status,
    ).toBe(500);
    expect(mock.responses).not.toHaveBeenCalled();
  });
  it("reports person persistence failures instead of claiming success", async () => {
    mock.responses.mockResolvedValue({
      output_text: '[{"name":"Ana","information":{}}]',
    });
    mock.data.saveExtractedPersonInfo.mockResolvedValue(null);
    expect(
      (
        await invoke("extract-people", {
          userId: "u",
          text: "Hola",
          entryDate: "2026-09-29",
        })
      ).status,
    ).toBe(500);
  });
  it("uses the relationship known at the entry date instead of future facts", async () => {
    mock.data.getPeopleByUserId.mockResolvedValue([
      {
        name: "Ana",
        details: {
          relacion: {
            entries: [
              { value: "amiga", date: "2025-01-01" },
              { value: "pareja", date: "2025-03-01" },
            ],
          },
        },
      },
    ]);
    mock.responses.mockResolvedValue({ output_text: "[]" });
    await invoke("extract-people", {
      userId: "u",
      text: "Hola",
      entryDate: "2025-02-01",
    });
    const context = JSON.parse(mock.responses.mock.calls[0][0].input);
    expect(context.personasConocidas[0].relacion).toBe("amiga");
    expect(JSON.stringify(context)).not.toContain("pareja");
  });
  it("returns a warning and does not fabricate mood values on invalid output", async () => {
    mock.responses
      .mockResolvedValueOnce({ output_text: "[]" })
      .mockResolvedValueOnce({ output_text: "{}" });
    const result = await invoke("extract-people", {
      userId: "u",
      text: "Hola",
      entryDate: "2026-09-29",
      entryId: "e",
    });
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({
      moodAnalysis: null,
      warning: expect.stringContaining("análisis emocional"),
    });
    expect(mock.data.updateEntryMoodData).not.toHaveBeenCalled();
  });
  it.each(["personal-chat", "chat-person"])(
    "%s enforces usage before OpenAI and does not increment",
    async (path) => {
      mock.subscriptions.reserveUsage.mockResolvedValue({
        allowed: false,
        currentUsage: 5,
        limit: 5,
      });
      const result = await invoke(path, {
        userId: "u",
        message: "Hola",
        person: { id: "p", name: "Ana", user_id: "u" },
      });
      expect(result.status).toBe(429);
      expect(mock.chat).not.toHaveBeenCalled();
      expect(
        mock.subscriptions.incrementPersonalChatUsage,
      ).not.toHaveBeenCalled();
      expect(
        mock.subscriptions.incrementPersonChatUsage,
      ).not.toHaveBeenCalled();
    },
  );
  it.each(["personal-chat", "chat-person"])(
    "%s answers and counts successful messages",
    async (path) => {
      const result = await invoke(path, {
        userId: "u",
        message: "Hola",
        conversationHistory: [{ role: "user", content: "Anterior" }],
        userName: "Ana",
        person: {
          id: "p",
          name: "Ana",
          details: {
            rol: { entries: [{ value: "Amiga", date: "2026-09-01" }] },
          },
        },
      });
      expect(result.status).toBe(200);
      expect(mock.chat.mock.calls[0][0]).toMatchObject({
        model: "gpt-6-luna",
        reasoning_effort: "none",
        max_completion_tokens: path === "personal-chat" ? 2500 : 2000,
      });
      expect(mock.chat.mock.calls[0][0]).not.toHaveProperty("max_tokens");
      expect(mock.chat.mock.calls[0][0].messages.at(-1)).toEqual({
        role: "user",
        content: "Hola",
      });
      expect(mock.subscriptions.finishUsage).toHaveBeenCalledWith(
        "u",
        "reservation",
        true,
      );
    },
  );
  it.each(["personal-chat", "chat-person"])(
    "%s does not count failed AI calls",
    async (path) => {
      mock.chat.mockRejectedValue(new Error("provider down"));
      expect(
        (
          await invoke(path, {
            userId: "u",
            message: "Hola",
            person: { id: "p", name: "Ana", details: {} },
          })
        ).status,
      ).toBe(500);
      expect(
        mock.subscriptions.incrementPersonalChatUsage,
      ).not.toHaveBeenCalled();
      expect(
        mock.subscriptions.incrementPersonChatUsage,
      ).not.toHaveBeenCalled();
    },
  );
  it.each(["personal-chat", "chat-person"])(
    "%s rejects missing messages",
    async (path) =>
      expect(
        (await invoke(path, { userId: "u", person: { id: "p", name: "Ana" } }))
          .status,
      ).toBe(400),
  );
  it("personal chat includes only the authorized diary in its context", async () => {
    mock.data.getDiaryEntriesByUserId.mockResolvedValue([
      {
        date: "2026-09-29",
        created_at: "2026-09-29",
        content: "Mi entrada",
        mentioned_people: ["Ana"],
      },
    ]);
    await invoke("personal-chat", {
      userId: "u",
      message: "Hola",
      userName: "Yo",
    });
    expect(mock.data.getDiaryEntriesByUserId).toHaveBeenCalledWith("u");
    expect(mock.chat.mock.calls[0][0].messages[0].content).toContain(
      "Mi entrada",
    );
  });
  it.each(["stylize", "extract-people"])(
    "%s rejects empty text",
    async (path) =>
      expect(
        (
          await invoke(path, {
            userId: "u",
            text: "   ",
            entryDate: "2026-09-29",
          })
        ).status,
      ).toBe(400),
  );
  it("stylize returns Responses API text and fallback preserves original", async () => {
    expect(
      await (await invoke("stylize", { userId: "u", text: "Original" })).json(),
    ).toMatchObject({ stylizedText: "Texto de prueba" });
    expect(mock.responses.mock.calls[0][0]).toMatchObject({
      model: "gpt-6-luna",
      reasoning: { effort: "low" },
      text: { verbosity: "low" },
    });
    expect(mock.responses.mock.calls[0][0]).not.toHaveProperty("temperature");
    mock.responses.mockResolvedValue({
      output: [{ content: [{ text: "Alternativo" }] }],
    });
    expect(
      await (await invoke("stylize", { userId: "u", text: "Original" })).json(),
    ).toMatchObject({ stylizedText: "Alternativo" });
    mock.responses.mockResolvedValue({});
    expect(
      await (await invoke("stylize", { userId: "u", text: "Original" })).json(),
    ).toMatchObject({ stylizedText: "Original" });
  });
  it("extract requires entry date", async () =>
    expect(
      (await invoke("extract-people", { userId: "u", text: "Hola" })).status,
    ).toBe(400));
  it.each([
    '[{"name":"Ana","information":{"rol":"amiga"}}]',
    '```json\n{"people":[{"name":"Ana","information":{"rol":"amiga"}}]}\n```',
  ])(
    "extract handles AI JSON formats and saves owner/date",
    async (output_text) => {
      mock.responses.mockResolvedValue({ output_text });
      const result = await invoke("extract-people", {
        userId: "u",
        text: "Vi a Ana",
        entryDate: "2026-09-29",
      });
      expect(result.status).toBe(200);
      expect(mock.data.saveExtractedPersonInfo).toHaveBeenCalledWith(
        "Ana",
        { rol: "amiga" },
        "u",
        "2026-09-29",
      );
    },
  );
  it("extract rejects invalid AI JSON without persisting people", async () => {
    mock.responses.mockResolvedValue({ output_text: "not json" });
    expect(
      (
        await invoke("extract-people", {
          userId: "u",
          text: "Hola",
          entryDate: "2026-09-29",
        })
      ).status,
    ).toBe(500);
    expect(mock.data.saveExtractedPersonInfo).not.toHaveBeenCalled();
  });
  it("extract cannot update mood of another account entry", async () => {
    mock.data.getEntryByIdForUser.mockResolvedValue(null);
    expect(
      (
        await invoke("extract-people", {
          userId: "u",
          text: "Hola",
          entryDate: "2026-09-29",
          entryId: "foreign",
        })
      ).status,
    ).toBe(404);
    expect(mock.responses).not.toHaveBeenCalled();
    expect(mock.data.updateEntryMoodData).not.toHaveBeenCalled();
  });
  it("persists neutral and unknown calm independently and sends the whole entry to analysis", async () => {
    const text =
      "Rutina con detalles. ".repeat(180) +
      "Un día normal sin nada destacable.";
    mock.responses
      .mockResolvedValueOnce({ output_text: "[]" })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          happiness: 0,
          tranquility: null,
          stress: 0,
          sadness: 0,
          neutral: 90,
        }),
      });
    const response = await invoke("extract-people", {
      userId: "u",
      text,
      entryDate: "2026-09-29",
      entryId: "e",
    });
    expect((await response.json()).moodAnalysis).toEqual({
      happiness: 0,
      tranquility: null,
      stress: 0,
      sadness: 0,
      neutral: 90,
    });
    expect(mock.data.updateEntryMoodData).toHaveBeenCalledWith("e", {
      happiness: 0,
      tranquility: null,
      stress: 0,
      sadness: 0,
      neutral: 90,
    });
    const payload = mock.responses.mock.calls[1][0];
    expect(JSON.parse(payload.input).texto).toBe(text);
    expect(payload.text.format.schema.required).toContain("neutral");
    expect(payload.text.format.schema.properties.neutral.type).toEqual([
      "number",
      "null",
    ]);
  });
  it("missing neutral in provider output warns without overwriting existing mood", async () => {
    mock.responses
      .mockResolvedValueOnce({ output_text: "[]" })
      .mockResolvedValueOnce({
        output_text:
          '{"happiness":0,"tranquility":null,"stress":0,"sadness":0}',
      });
    const response = await invoke("extract-people", {
      userId: "u",
      text: "Un día normal.",
      entryDate: "2026-09-29",
      entryId: "e",
    });
    expect((await response.json()).warning).toContain("no se pudo actualizar");
    expect(mock.data.updateEntryMoodData).not.toHaveBeenCalled();
  });
  it("clamps mood scores to 0–100 and rounds them", async () => {
    mock.responses
      .mockResolvedValueOnce({ output_text: "[]" })
      .mockResolvedValueOnce({
        output_text:
          '{"happiness":130,"stress":-20,"tranquility":34.8,"sadness":0,"neutral":12.7}',
      });
    const result = await invoke("extract-people", {
      userId: "u",
      text: "Hola",
      entryDate: "2026-09-29",
      entryId: "e",
    });
    expect(result.status).toBe(200);
    expect(mock.data.updateEntryMoodData).toHaveBeenCalledWith("e", {
      happiness: 100,
      stress: 0,
      tranquility: 35,
      sadness: 0,
      neutral: 13,
    });
    expect(mock.responses).toHaveBeenCalledTimes(2);
    for (const [payload] of mock.responses.mock.calls) {
      expect(payload).toMatchObject({
        model: "gpt-6-luna",
        reasoning: { effort: "low" },
      });
      expect(payload).not.toHaveProperty("temperature");
    }
  });
  it.each([0, 20, 999])(
    "transcribe rejects missing/tiny audio (%s bytes)",
    async (size) => {
      const form = new FormData();
      if (size)
        form.set(
          "file",
          new File([new Uint8Array(size)], "voice.wav", { type: "audio/wav" }),
        );
      const result = await (
        await load("transcribe")
      ).POST(
        new Request("http://localhost/api/transcribe", {
          method: "POST",
          body: form,
        }),
      );
      expect(result.status).toBe(400);
      expect(mock.transcription).not.toHaveBeenCalled();
    },
  );
  it("transcribes audio and returns a playable data URL", async () => {
    const form = new FormData();
    form.set(
      "file",
      new File([new Uint8Array(2000)], "voice.wav", { type: "audio/wav" }),
    );
    const result = await (
      await load("transcribe")
    ).POST(
      new Request("http://localhost/api/transcribe", {
        method: "POST",
        body: form,
      }),
    );
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({
      text: "Transcripción de prueba",
      audioUrl: expect.stringMatching(/^data:audio\/wav;base64,/),
    });
    expect(mock.transcription.mock.calls[0][0]).toMatchObject({
      model: "gpt-transcribe",
      languages: ["es"],
    });
    const [payload] = mock.transcription.mock.calls[0];
    expect(payload.file.name).toBe("recording.wav");
    expect(payload.file.type).toBe("audio/wav");
    expect(payload.file.size).toBe(2000);
    for (const legacy of ["language", "temperature", "response_format"]) {
      expect(payload).not.toHaveProperty(legacy);
    }
  });
  it("preserves WebM bytes and names the upload for its actual container", async () => {
    const form = new FormData();
    const bytes = new Uint8Array(2000);
    bytes[0] = 26;
    form.set(
      "file",
      new File([bytes], "recording.wav", { type: "audio/webm;codecs=opus" }),
    );
    const response = await (
      await load("transcribe")
    ).POST(new Request("http://localhost", { method: "POST", body: form }));
    expect(response.status).toBe(200);
    const file = mock.transcription.mock.calls[0][0].file;
    expect(file.name).toBe("recording.webm");
    expect(file.type).toBe("audio/webm;codecs=opus");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
  });
  it("rejects audio beyond the provider file limit before calling OpenAI", async () => {
    const form = new FormData();
    form.set(
      "file",
      new File([new Uint8Array(25 * 1024 * 1024 + 1)], "large.wav", {
        type: "audio/wav",
      }),
    );
    const response = await (
      await load("transcribe")
    ).POST(new Request("http://localhost", { method: "POST", body: form }));
    expect(response.status).toBe(413);
    expect(mock.transcription).not.toHaveBeenCalled();
  });
  it("rejects audio that would exceed the hosting response limit after base64 encoding", async () => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array(3 * 1024 * 1024 + 1)], "large.webm", { type: "audio/webm" }));
    const response = await (await load("transcribe")).POST(new Request("http://localhost", { method: "POST", body: form }));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: "AUDIO_TOO_LARGE" });
    expect(mock.transcription).not.toHaveBeenCalled();
  });
  it("does not accept empty transcription", async () => {
    mock.transcription.mockResolvedValue({ text: " " });
    const form = new FormData();
    form.set("file", new File([new Uint8Array(2000)], "a.wav"));
    expect(
      (
        await (
          await load("transcribe")
        ).POST(new Request("http://localhost", { method: "POST", body: form }))
      ).status,
    ).toBe(400);
  });
  it.each([
    {
      code: "credit_balance_exhausted",
      type: "insufficient_quota",
      expected: "AI_CREDITS_EXHAUSTED",
    },
    { code: "insufficient_quota", expected: "AI_CREDITS_EXHAUSTED" },
    { code: "rate_limit_exceeded", expected: "AI_RATE_LIMITED" },
  ])(
    "returns a safe transcription availability error ($code)",
    async ({ code, type, expected }) => {
      mock.transcription.mockRejectedValue({
        status: 429,
        code,
        type,
        message: "private-provider-detail",
      });
      const form = new FormData();
      form.set(
        "file",
        new File([new Uint8Array(2000)], "voice.webm", { type: "audio/webm" }),
      );
      const response = await (
        await load("transcribe")
      ).POST(new Request("http://localhost", { method: "POST", body: form }));
      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.code).toBe(expected);
      expect(body.error).not.toContain("private-provider-detail");
      if (expected === "AI_CREDITS_EXHAUSTED")
        expect(body.error).toContain("saldo");
    },
  );
  it.each(["statistics/summary", "statistics/quote"])(
    "%s reads cached reports without direct AI calls",
    async (path) => {
      db.reply({
        report: {
          weekSummary: "Resumen guardado",
          instagramQuote: "Cita guardada",
        },
      });
      expect((await invoke(path, {}, "GET")).status).toBe(200);
      expect(mock.responses).not.toHaveBeenCalled();
    },
  );
  it.each(["statistics/summary", "statistics/quote"])(
    "%s requires a previously generated report",
    async (path) => {
      expect((await invoke(path, {}, "GET")).status).toBe(409);
      expect(mock.responses).not.toHaveBeenCalled();
    },
  );
  it("ranks people using distinct diary mentions per entry instead of drifted counters", async () => {
    mock.data.getDiaryEntriesByUserId.mockResolvedValue([
      { mentioned_people: ["Ana", "Ana", "Luis"] },
      { mentioned_people: ["Ana"] },
    ]);
    expect(await (await invoke("statistics/people", {}, "GET")).json()).toEqual(
      {
        topPeople: [
          { name: "Ana", count: 2 },
          { name: "Luis", count: 1 },
        ],
      },
    );
    expect(mock.data.getDiaryEntriesByUserId).toHaveBeenCalledWith("u");
  });
  it.each(["summary", "quote", "mood", "people"])(
    "free users cannot bypass the %s gate directly",
    async (section) => {
      mock.subscriptions.getUserProfile.mockResolvedValue(profile("free"));
      expect((await invoke(`statistics/${section}`, {}, "GET")).status).toBe(
        403,
      );
      expect(mock.responses).not.toHaveBeenCalled();
    },
  );
  it("bundles two AI outputs into one quota reservation and one atomic report commit", async () => {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    mock.data.getDiaryEntriesByUserId.mockResolvedValue([
      {
        date: today,
        content: "Hoy tuve un buen día",
        mentioned_people: ["Ana"],
      },
    ]);
    expect((await invoke("statistics/report", {})).status).toBe(200);
    expect(mock.responses).toHaveBeenCalledTimes(2);
    expect(mock.subscriptions.reserveUsage).toHaveBeenCalledWith(
      "u",
      "statisticsAccess",
    );
    expect(db.rpc).toHaveBeenCalledWith(
      "complete_statistics_report",
      expect.objectContaining({ p_user_id: "u", p_id: "reservation" }),
    );
    expect(mock.responses.mock.calls[0][0]).toMatchObject({
      model: "gpt-6-luna",
      reasoning: { effort: "low" },
    });
  });
  it("a cached complete report consumes no new access", async () => {
    db.reply({
      report: { weekSummary: "cached" },
      generated_at: new Date().toISOString(),
    });
    expect(await (await invoke("statistics/report", {})).json()).toMatchObject({
      cached: true,
      weekSummary: "cached",
    });
    expect(mock.subscriptions.reserveUsage).not.toHaveBeenCalled();
  });
  it("failed generation releases the quota and never publishes a report", async () => {
    const today = new Date().toISOString().slice(0, 10);
    mock.data.getDiaryEntriesByUserId.mockResolvedValue([
      { date: today, content: "Hola" },
    ]);
    mock.responses.mockRejectedValue(new Error("provider down"));
    expect((await invoke("statistics/report", { refresh: true })).status).toBe(
      500,
    );
    expect(mock.subscriptions.finishUsage).toHaveBeenCalledWith(
      "u",
      "reservation",
      false,
    );
    expect(db.rpc).not.toHaveBeenCalledWith(
      "complete_statistics_report",
      expect.anything(),
    );
  });
  it.each(["week", "month", "year"])(
    "mood period %s sorts real scores without fabricating empty data",
    async (period) => {
      mock.data.getEntriesMoodDataByDateRange.mockResolvedValue([
        {
          date: "2026-09-29",
          happiness: 80,
          stress: 10,
          sadness: 0,
          tranquility: 50,
        },
        {
          date: "2026-09-28",
          happiness: 20,
          stress: 90,
          sadness: 60,
          tranquility: 10,
        },
      ]);
      const route = await load("statistics/mood");
      const result = await route.GET(
        request(`statistics/mood?moodPeriod=${period}`, {}, "GET"),
      );
      expect(result.status).toBe(200);
      expect((await result.json()).moodData[0].date).toBe("2026-09-28");
      mock.data.getEntriesMoodDataByDateRange.mockResolvedValue([]);
      expect(
        await (await route.GET(request("statistics/mood", {}, "GET"))).json(),
      ).toEqual({ moodData: [] });
    },
  );
  it("rejects an invalid mood period without calling the database", async () => {
    expect(
      (
        await (
          await load("statistics/mood")
        ).GET(request("statistics/mood?moodPeriod=invalid", {}, "GET"))
      ).status,
    ).toBe(400);
    expect(mock.data.getEntriesMoodDataByDateRange).not.toHaveBeenCalled();
  });
  it("statistics quota is enforced before AI", async () => {
    mock.subscriptions.reserveUsage.mockResolvedValue({
      allowed: false,
      currentUsage: 10,
      limit: 10,
    });
    expect((await invoke("statistics/access", { userId: "u" })).status).toBe(
      429,
    );
    expect(mock.responses).not.toHaveBeenCalled();
  });
});
describe("account and feedback", () => {
  beforeEach(() => {
    db.rpc.mockResolvedValue({
      data: { allowed: true, id: "report-test", duplicate: false },
      error: null,
    });
  });
  it("feedback cannot spoof another sender", async () => {
    expect(
      (
        await invoke("send-feedback", {
          type: "problem",
          message: "Hola",
          userEmail: "other@test.invalid",
        })
      ).status,
    ).toBe(403);
    expect(mock.sendEmail).not.toHaveBeenCalled();
  });
  it("feedback rate is checked before delivery", async () => {
    db.rpc.mockResolvedValue({ data: { allowed: false }, error: null });
    expect(
      (
        await invoke("send-feedback", {
          type: "problem",
          message: "Hola",
          userEmail: "u@test.invalid",
        })
      ).status,
    ).toBe(429);
    expect(mock.sendEmail).not.toHaveBeenCalled();
  });

  it("deletes only the authenticated account even with a forged body", async () => {
    expect((await invoke("account", { userId: "other" })).status).toBe(200);
    expect(mock.deleteUser).toHaveBeenCalledWith("u");
  });
  it("reports account deletion failure", async () => {
    mock.deleteUser.mockResolvedValue({ error: new Error("denied") });
    expect((await invoke("account")).status).toBe(500);
  });
  it.each([
    { type: "invalid", message: "x", userEmail: "u@test.invalid" },
    { type: "problem", message: "", userEmail: "u@test.invalid" },
    { type: "problem", message: "x".repeat(5001), userEmail: "u@test.invalid" },
    { type: "problem", message: "x", userEmail: "bad" },
  ])("rejects invalid feedback %#", async (body) => {
    expect((await invoke("send-feedback", body)).status).toBe(400);
    expect(mock.sendEmail).not.toHaveBeenCalled();
  });
  it("escapes HTML in feedback before sending", async () => {
    const result = await invoke("send-feedback", {
      type: "problem",
      message: "<script>alert(1)</script>",
      userEmail: "u@test.invalid",
    });
    expect(result.status).toBe(200);
    expect(mock.sendEmail.mock.calls[0][0].html).toContain("&lt;script&gt;");
    expect(mock.sendEmail.mock.calls[0][0].html).not.toContain("<script>");
  });
  it("saved feedback survives mail provider failure", async () => {
    mock.sendEmail.mockResolvedValue({ error: { message: "failed" } });
    expect(
      (
        await invoke("send-feedback", {
          type: "suggestion",
          message: "Hola",
          userEmail: "u@test.invalid",
        })
      ).status,
    ).toBe(200);
  });
});
describe("subscription maintenance", () => {
  it.each(["GET", "POST"])(
    "status %s returns current profile only",
    async (method) => {
      const route = await load("subscription/status");
      const req = request(
        method === "GET"
          ? "subscription/status?userId=u"
          : "subscription/status",
        { userId: "u" },
        method,
      );
      expect(await (await route[method](req)).json()).toMatchObject({
        subscription: { plan: "pro" },
        isFirstLogin: false,
      });
    },
  );
  it("status returns 404 for missing profile", async () => {
    mock.subscriptions.getUserProfile.mockResolvedValue(null);
    expect((await invoke("subscription/status", { userId: "u" })).status).toBe(
      404,
    );
  });
  it("manual update cannot grant a paid plan or erase active Stripe billing", async () => {
    expect(
      (
        await invoke("subscription/update-manual", {
          userId: "u",
          planType: "elite",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await invoke("subscription/update-manual", {
          userId: "u",
          planType: "free",
        })
      ).status,
    ).toBe(409);
    expect(mock.subscriptions.updateUserSubscription).not.toHaveBeenCalled();
  });
  it("manual update allows free only after canceled period expires", async () => {
    mock.subscriptions.getUserProfile.mockResolvedValue(
      profile("pro", {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date("2020-01-01"),
      }),
    );
    expect(
      (
        await invoke("subscription/update-manual", {
          userId: "u",
          planType: "free",
        })
      ).status,
    ).toBe(200);
    expect(mock.subscriptions.updateUserSubscription).toHaveBeenCalledWith(
      "u",
      expect.objectContaining({
        plan: "free",
        cancelAtPeriodEnd: false,
      }),
    );
  });
  it.each(["GET", "POST"])(
    "cron %s requires the configured secret",
    async (method) => {
      const route = await load("subscription/expire-subscriptions");
      expect(
        (
          await route[method](
            request("subscription/expire-subscriptions", {}, method),
          )
        ).status,
      ).toBe(401);
      vi.stubEnv("CRON_SECRET", "");
      expect(
        (
          await route[method](
            request("subscription/expire-subscriptions", {}, method, {
              authorization: "Bearer ",
            }),
          )
        ).status,
      ).toBe(401);
      expect(db.calls).toHaveLength(0);
    },
  );
  it("cron updates only normalized eligible subscriptions in one filtered query", async () => {
    db.reply([{ user_id: "old" }]);
    const result = await (
      await load("subscription/expire-subscriptions")
    ).POST(
      request("subscription/expire-subscriptions", {}, "POST", {
        authorization: "Bearer cron_fixture",
      }),
    );
    expect(await result.json()).toMatchObject({ expired: 1 });
    expect(db.calls[0].table).toBe("subscriptions");
    expect(db.calls[0].steps).toContainEqual([
      "eq",
      "cancel_at_period_end",
      true,
    ]);
    expect(db.calls[0].steps).toContainEqual(["eq", "status", "active"]);
    expect(db.calls[0].steps[0][1]).not.toHaveProperty("stripe_customer_id");
  });
  it("cron reports write failures", async () => {
    db.reply(null, new Error("down"));
    expect(
      (
        await (
          await load("subscription/expire-subscriptions")
        ).POST(
          request("subscription/expire-subscriptions", {}, "POST", {
            authorization: "Bearer cron_fixture",
          }),
        )
      ).status,
    ).toBe(500);
  });
});
describe("Stripe checkout and cancellation without charges", () => {
  it.each([
    ["pro", "usd", 499],
    ["pro", "eur", 999],
    ["elite", "eur", 1999],
  ])(
    "rejects %s with mismatched currency %s or amount %i",
    async (planType, currency, amount) => {
      mock.subscriptions.getUserProfile.mockResolvedValue(
        profile("free", {
          status: "inactive",
          stripeSubscriptionId: undefined,
        }),
      );
      mock.stripe.prices.retrieve.mockResolvedValue({
        active: true,
        currency,
        unit_amount: amount,
        recurring: { interval: "month", interval_count: 1 },
      });
      expect(
        (
          await invoke("stripe/create-checkout-session", {
            userId: "u",
            userEmail: "u@test.invalid",
            planType,
            requestId: "11111111-1111-4111-8111-111111111111",
          })
        ).status,
      ).toBe(500);
      expect(mock.stripe.checkout.sessions.create).not.toHaveBeenCalled();
    },
  );
  it("a paid return waits for the database webhook state without granting itself a plan", async () => {
    mock.subscriptions.getUserProfile.mockResolvedValue(
      profile("free", { status: "inactive" }),
    );
    expect(
      await (
        await invoke("stripe/verify-payment", {
          userId: "u",
          sessionId: "cs_test",
        })
      ).json(),
    ).toMatchObject({ success: true, activated: false });
    expect(mock.subscriptions.updateUserSubscription).not.toHaveBeenCalled();
  });
  it("existing subscriptions use the customer portal instead of creating a second charge", async () => {
    mock.stripe.subscriptions.retrieve.mockResolvedValue({
      ...subscription,
      customer: "cus_existing",
    });
    mock.subscriptions.getUserProfile.mockResolvedValue(
      profile("pro", { stripeCustomerId: "cus_existing" }),
    );
    expect(
      await (
        await invoke("stripe/create-checkout-session", {
          userId: "u",
          userEmail: "u@test.invalid",
          planType: "elite",
          requestId: "11111111-1111-4111-8111-111111111111",
        })
      ).json(),
    ).toEqual({ portalUrl: "https://billing.stripe.com/p/session/fixture" });
    expect(mock.stripe.checkout.sessions.create).not.toHaveBeenCalled();
    expect(mock.stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_existing",
      return_url: "http://localhost:3100/subscription",
      locale: "es",
    });
  });
  it("disabled portal never contacts Stripe", async () => {
    mock.enabled.mockReturnValue(false);
    expect((await invoke("stripe/create-portal-session")).status).toBe(503);
    expect(mock.stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
  });
  it("portal derives the customer from the authenticated owner, ignoring forged body IDs", async () => {
    mock.subscriptions.getUserProfile.mockResolvedValue(
      profile("pro", { stripeCustomerId: "cus_own" }),
    );
    expect(
      (
        await invoke("stripe/create-portal-session", {
          userId: "other",
          customer: "cus_foreign",
        })
      ).status,
    ).toBe(200);
    expect(mock.stripe.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_own" }),
    );
  });
  it("canceling a manual subscription preserves its existing paid date", async () => {
    const end = new Date("2099-01-01");
    mock.subscriptions.getUserProfile.mockResolvedValue(
      profile("pro", {
        stripeSubscriptionId: undefined,
        currentPeriodEnd: end,
      }),
    );
    expect(
      (await invoke("stripe/cancel-subscription", { userId: "u" })).status,
    ).toBe(200);
    expect(mock.subscriptions.updateUserSubscription).toHaveBeenCalledWith(
      "u",
      { cancelAtPeriodEnd: true, currentPeriodEnd: end },
    );
    expect(mock.stripe.subscriptions.update).not.toHaveBeenCalled();
  });
  it("manual cancellation never invents a missing paid month", async () => {
    mock.subscriptions.getUserProfile.mockResolvedValue(
      profile("pro", { stripeSubscriptionId: undefined }),
    );
    expect(
      (await invoke("stripe/cancel-subscription", { userId: "u" })).status,
    ).toBe(409);
    expect(mock.subscriptions.updateUserSubscription).not.toHaveBeenCalled();
  });

  it("plans exposes configured prices and payment availability", async () => {
    expect(
      await (await invoke("subscription/plans", {}, "GET")).json(),
    ).toMatchObject({
      pro: "price_pro",
      elite: "price_elite",
      prices: { free: 0, pro: 4.99, elite: 9.99 },
      checkoutEnabled: true,
    });
    mock.enabled.mockReturnValue(false);
    vi.stubEnv("STRIPE_PRO_PRICE_ID", "");
    expect(
      await (await invoke("subscription/plans", {}, "GET")).json(),
    ).toMatchObject({ pro: null, checkoutEnabled: false });
  });
  it("disabled checkout cannot create sessions", async () => {
    mock.enabled.mockReturnValue(false);
    expect(
      (await invoke("stripe/create-checkout-session", { userId: "u" })).status,
    ).toBe(503);
    expect(mock.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("rejects a mismatched checkout email", async () =>
    expect(
      (
        await invoke("stripe/create-checkout-session", {
          userId: "u",
          userEmail: "other@test.invalid",
          planType: "pro",
        })
      ).status,
    ).toBe(403));
  it.each(["pro", "elite"])(
    "creates %s checkout using trusted return URLs",
    async (planType) => {
      mock.subscriptions.getUserProfile.mockResolvedValue(
        profile("free", {
          status: "inactive",
          stripeSubscriptionId: undefined,
        }),
      );
      const result = await invoke("stripe/create-checkout-session", {
        userId: "u",
        userEmail: "u@test.invalid",
        planType,
        requestId: "11111111-1111-4111-8111-111111111111",
        successUrl: "https://attacker.invalid",
        cancelUrl: "https://attacker.invalid",
      });
      expect(await result.json()).toEqual({
        sessionId: "cs_test",
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test",
      });
      expect(mock.stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "subscription",
          line_items: [{ price: `price_${planType}`, quantity: 1 }],
          consent_collection: { terms_of_service: "required" },
          custom_text: expect.objectContaining({
            terms_of_service_acceptance: {
              message: expect.stringContaining(
                "https://www.lumadiary.com/terminos",
              ),
            },
          }),
          success_url:
            "http://localhost:3100/billing/return?session_id={CHECKOUT_SESSION_ID}",
          cancel_url: "http://localhost:3100/subscription",
          metadata: expect.objectContaining({ uid: "u", plan_type: planType }),
        }),
        expect.objectContaining({
          idempotencyKey: expect.stringContaining("secondbrain-checkout-u-"),
        }),
      );
    },
  );
  it("reuses the stored Stripe customer", async () => {
    mock.subscriptions.getUserProfile.mockResolvedValue(
      profile("free", {
        status: "inactive",
        stripeSubscriptionId: undefined,
        stripeCustomerId: "cus_existing",
      }),
    );
    await invoke("stripe/create-checkout-session", {
      userId: "u",
      userEmail: "u@test.invalid",
      planType: "pro",
      requestId: "11111111-1111-4111-8111-111111111111",
    });
    expect(mock.stripe.customers.create).not.toHaveBeenCalled();
    expect(mock.stripe.checkout.sessions.create.mock.calls[0][0].customer).toBe(
      "cus_existing",
    );
  });
  it("rejects unknown checkout plans", async () => {
    expect(
      (
        await invoke("stripe/create-checkout-session", {
          userId: "u",
          userEmail: "u@test.invalid",
          planType: "admin",
        })
      ).status,
    ).toBe(400);
    expect(mock.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("cancels at Stripe period end and stores its confirmed date", async () => {
    expect(
      (await invoke("stripe/cancel-subscription", { userId: "u" })).status,
    ).toBe(200);
    expect(mock.stripe.subscriptions.update).toHaveBeenCalledWith("sub_test", {
      cancel_at_period_end: true,
    });
    expect(mock.subscriptions.updateUserSubscription).toHaveBeenCalledWith(
      "u",
      {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date(1800000000 * 1000),
      },
    );
  });
  it.each([new Error("Stripe unavailable"), { current_period_end: 0 }])(
    "failed cancellation never marks the database canceled",
    async (value) => {
      if (value instanceof Error)
        mock.stripe.subscriptions.update.mockRejectedValue(value);
      else mock.stripe.subscriptions.update.mockResolvedValue(value);
      expect(
        (await invoke("stripe/cancel-subscription", { userId: "u" })).status,
      ).toBe(502);
      expect(mock.subscriptions.updateUserSubscription).not.toHaveBeenCalled();
    },
  );
  it("does not cancel a free or missing subscription", async () => {
    mock.subscriptions.getUserProfile.mockResolvedValue(profile("free"));
    expect(
      (await invoke("stripe/cancel-subscription", { userId: "u" })).status,
    ).toBe(400);
    mock.subscriptions.getUserProfile.mockResolvedValue(null);
    expect(
      (await invoke("stripe/cancel-subscription", { userId: "u" })).status,
    ).toBe(404);
  });
  it("verifies current paid Stripe state without provisioning from the browser", async () => {
    expect(
      (
        await invoke("stripe/verify-payment", {
          userId: "u",
          sessionId: "cs_test",
        })
      ).status,
    ).toBe(200);
    expect(mock.subscriptions.updateUserSubscription).not.toHaveBeenCalled();
    expect(mock.subscriptions.markFirstPaymentComplete).not.toHaveBeenCalled();
  });
  it.each(["paid", "unpaid"])(
    "foreign %s checkout is rejected without exposing its session",
    async (payment_status) => {
      mock.stripe.checkout.sessions.retrieve.mockResolvedValue({
        payment_status,
        metadata: { uid: "other" },
        customer: "foreign-secret",
      });
      const result = await invoke("stripe/verify-payment", {
        userId: "u",
        sessionId: "cs_foreign",
      });
      expect(result.status).toBe(403);
      expect(await result.json()).not.toHaveProperty("session");
      expect(mock.subscriptions.updateUserSubscription).not.toHaveBeenCalled();
    },
  );
  it("unpaid own checkout cannot activate the plan", async () => {
    mock.stripe.checkout.sessions.retrieve.mockResolvedValue({
      payment_status: "unpaid",
      metadata: { uid: "u" },
    });
    expect(
      (
        await invoke("stripe/verify-payment", {
          userId: "u",
          sessionId: "cs_test",
        })
      ).status,
    ).toBe(400);
    expect(mock.subscriptions.updateUserSubscription).not.toHaveBeenCalled();
  });
});
describe("signed Stripe events", () => {
  const webhook = async (type: string, object: any) => {
    mock.stripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_fixture",
      created: 1800000000,
      type,
      data: { object },
    });
    return (await load("stripe/webhook")).POST(
      request("stripe/webhook", {}, "POST", { "stripe-signature": "fixture" }),
    );
  };
  it("rejects missing signatures", async () => {
    expect((await invoke("stripe/webhook")).status).toBe(400);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("validates a real signature and rejects a tampered payload", async () => {
    const sdk = new Stripe("sk_test_fixture");
    mock.stripe.webhooks.constructEvent.mockImplementation(
      sdk.webhooks.constructEvent.bind(sdk.webhooks),
    );
    const body = JSON.stringify({
      id: "evt_fixture",
      type: "ignored.fixture",
      data: { object: {} },
    });
    const signature = sdk.webhooks.generateTestHeaderString({
      payload: body,
      secret: "whsec_fixture",
    });
    const route = await load("stripe/webhook");
    const send = (payload: string) =>
      route.POST(
        new NextRequest("http://localhost/api/stripe/webhook", {
          method: "POST",
          body: payload,
          headers: { "stripe-signature": signature },
        }),
      );
    expect((await send(body)).status).toBe(200);
    expect((await send(body + " ")).status).toBe(400);
  });
  it("checkout provisions only through a signed paid subscription event", async () => {
    expect(
      (
        await webhook("checkout.session.completed", {
          mode: "subscription",
          payment_status: "paid",
          customer: "cus_test",
          subscription: "sub_test",
          metadata: { uid: "u" },
        })
      ).status,
    ).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith(
      "apply_billing_event",
      expect.objectContaining({
        p_id: "evt_fixture",
        p_user_id: "u",
        p_subscription: expect.objectContaining({
          plan: "pro",
          status: "active",
        }),
      }),
    );
  });
  it.each([
    "active",
    "canceled",
    "unpaid",
    "past_due",
    "incomplete",
    "incomplete_expired",
    "trialing",
    "paused",
  ])("maps current provider status %s", async (status) => {
    mock.stripe.subscriptions.retrieve.mockResolvedValue({
      ...subscription,
      status,
    });
    expect(
      (
        await webhook("customer.subscription.updated", {
          id: "sub_test",
          status: "obsolete",
        })
      ).status,
    ).toBe(200);
    const expected =
      status === "active"
        ? "active"
        : status === "past_due"
          ? "past_due"
          : ["canceled", "unpaid"].includes(status)
            ? "canceled"
            : "inactive";
    expect(db.rpc).toHaveBeenCalledWith(
      "apply_billing_event",
      expect.objectContaining({
        p_subscription: expect.objectContaining({
          status: expected,
          plan: expected === "canceled" ? "free" : "pro",
        }),
      }),
    );
  });
  it.each([
    "invoice.paid",
    "invoice.payment_succeeded",
    "invoice.payment_failed",
  ])(
    "%s re-reads current subscription rather than trusting a stale invoice",
    async (type) => {
      expect((await webhook(type, { id: "in_test" })).status).toBe(200);
      expect(mock.stripe.invoices.retrieve).toHaveBeenCalledWith("in_test");
      expect(mock.stripe.subscriptions.retrieve).toHaveBeenCalledWith(
        "sub_test",
        { expand: ["latest_invoice"] },
      );
      expect(db.rpc.mock.calls[0][1].p_subscription.status).toBe("active");
    },
  );
  it("unknown owner and prices fail without writing a plan", async () => {
    mock.subscriptions.findUserByStripeCustomerId.mockResolvedValue(null);
    expect(
      (await webhook("customer.subscription.updated", { id: "sub_test" }))
        .status,
    ).toBe(500);
    expect(db.rpc).not.toHaveBeenCalled();
    mock.subscriptions.findUserByStripeCustomerId.mockResolvedValue("u");
    mock.stripe.subscriptions.retrieve.mockResolvedValue({
      ...subscription,
      items: {
        data: [{ current_period_end: 1800000000, price: { id: "unknown" } }],
      },
    });
    expect(
      (await webhook("customer.subscription.updated", { id: "sub_test" }))
        .status,
    ).toBe(500);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("database failures request provider retry", async () => {
    db.rpc.mockResolvedValue({ data: null, error: new Error("down") });
    expect(
      (await webhook("customer.subscription.deleted", { id: "sub_test" }))
        .status,
    ).toBe(500);
  });
});

describe("billing readiness edge cases", () => {
  const body = {
    userId: "u",
    userEmail: "u@test.invalid",
    planType: "pro",
    requestId: "11111111-1111-4111-8111-111111111111",
  };
  it.each(["incomplete", "past_due", "unpaid", "paused", "trialing"])(
    "provider %s status prevents a second subscription even when local status is inactive",
    async (status) => {
      mock.subscriptions.getUserProfile.mockResolvedValue(
        profile("free", { status: "inactive" }),
      );
      mock.stripe.subscriptions.retrieve.mockResolvedValue({
        ...subscription,
        status,
      });
      expect(
        await (await invoke("stripe/create-checkout-session", body)).json(),
      ).toHaveProperty("portalUrl");
      expect(mock.stripe.checkout.sessions.create).not.toHaveBeenCalled();
    },
  );
  it("foreign provider customer blocks checkout", async () => {
    mock.stripe.subscriptions.retrieve.mockResolvedValue({
      ...subscription,
      customer: "cus_foreign",
    });
    expect((await invoke("stripe/create-checkout-session", body)).status).toBe(
      403,
    );
    expect(mock.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it.each(["open", "draft", "void", "uncollectible", null])(
    "an active subscription with invoice %s does not receive paid access",
    async (status) => {
      mock.stripe.subscriptions.retrieve.mockResolvedValue({
        ...subscription,
        latest_invoice: status ? { id: "in_test", status } : null,
      });
      mock.stripe.webhooks.constructEvent.mockReturnValue({
        id: "evt_delayed",
        created: 1700000000,
        type: "customer.subscription.created",
        data: { object: { id: "sub_test" } },
      });
      const result = await (
        await load("stripe/webhook")
      ).POST(
        request("stripe/webhook", {}, "POST", {
          "stripe-signature": "fixture",
        }),
      );
      expect(result.status).toBe(200);
      expect(db.rpc).toHaveBeenCalledWith(
        "apply_billing_event",
        expect.objectContaining({
          p_subscription: expect.objectContaining({ status: "inactive" }),
        }),
      );
    },
  );
  it("malformed checkout request ID is rejected before contacting prices or creating a session", async () => {
    expect(
      (
        await invoke("stripe/create-checkout-session", {
          ...body,
          requestId: "------------------------------------",
        })
      ).status,
    ).toBe(400);
    expect(mock.stripe.prices.retrieve).not.toHaveBeenCalled();
    expect(mock.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("missing hosted checkout URL never reports successful checkout", async () => {
    mock.subscriptions.getUserProfile.mockResolvedValue(
      profile("free", { status: "inactive", stripeSubscriptionId: undefined }),
    );
    mock.stripe.checkout.sessions.create.mockResolvedValue({
      id: "cs_test",
      url: null,
    });
    expect((await invoke("stripe/create-checkout-session", body)).status).toBe(
      500,
    );
  });
});

it("pending billing SQL blocks checkout and portal without contacting Stripe", async () => {
  mock.schema.mockResolvedValue(false);
  expect((await invoke("stripe/create-checkout-session", {})).status).toBe(503);
  expect((await invoke("stripe/create-portal-session", {})).status).toBe(503);
  expect(mock.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  expect(mock.stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
});

it("account deletion closes billing before removing Auth identity", async () => {
  mock.stripe.checkout.sessions.list.mockResolvedValue({
    data: [{ id: "cs_pending" }],
    has_more: false,
  });
  expect((await invoke("account")).status).toBe(200);
  expect(mock.stripe.checkout.sessions.expire).toHaveBeenCalledWith(
    "cs_pending",
  );
  expect(mock.stripe.customers.del).toHaveBeenCalledWith("cus_test");
  expect(mock.stripe.customers.del.mock.invocationCallOrder[0]).toBeLessThan(
    mock.deleteUser.mock.invocationCallOrder[0],
  );
});
it("failed billing cancellation preserves the account for recovery", async () => {
  mock.stripe.customers.del.mockRejectedValueOnce(
    new Error("Provider unavailable"),
  );
  expect((await invoke("account")).status).toBe(500);
  expect(mock.deleteUser).not.toHaveBeenCalled();
});
it("foreign customer metadata cannot be deleted with this account", async () => {
  mock.stripe.customers.retrieve.mockResolvedValue({
    id: "cus_test",
    metadata: { uid: "foreign" },
  });
  expect((await invoke("account")).status).toBe(500);
  expect(mock.stripe.customers.del).not.toHaveBeenCalled();
  expect(mock.deleteUser).not.toHaveBeenCalled();
});

it("late events after confirmed Stripe customer deletion are acknowledged without recreating the account", async () => {
  mock.subscriptions.findUserByStripeCustomerId.mockResolvedValue(null);
  mock.stripe.customers.retrieve.mockResolvedValue({
    id: "cus_test",
    deleted: true,
  });
  mock.stripe.webhooks.constructEvent.mockReturnValue({
    id: "evt_closed",
    created: 1700000000,
    type: "customer.subscription.deleted",
    data: { object: { id: "sub_test" } },
  });
  expect(
    (
      await (
        await load("stripe/webhook")
      ).POST(
        request("stripe/webhook", {}, "POST", {
          "stripe-signature": "fixture",
        }),
      )
    ).status,
  ).toBe(200);
  expect(db.rpc).not.toHaveBeenCalled();
  expect(mock.subscriptions.markFirstPaymentComplete).not.toHaveBeenCalled();
});

it("foreign subscription cannot be canceled even with a stored reference", async () => {
  mock.stripe.subscriptions.retrieve.mockResolvedValue({
    ...subscription,
    metadata: { uid: "foreign" },
  });
  expect(
    (await invoke("stripe/cancel-subscription", { userId: "u" })).status,
  ).toBe(403);
  expect(mock.stripe.subscriptions.update).not.toHaveBeenCalled();
});

describe("shared hosted checkout attempts", () => {
  const body = {
    userId: "u",
    userEmail: "u@test.invalid",
    planType: "pro",
    requestId: "11111111-1111-4111-8111-111111111111",
  };
  const attempt = {
    requestId: body.requestId,
    plan: "pro",
    sessionId: null,
    expiresAt: "2030-01-01T00:00:00.000Z",
  };
  beforeEach(() =>
    mock.subscriptions.getUserProfile.mockResolvedValue(
      profile("free", { status: "inactive", stripeSubscriptionId: undefined }),
    ),
  );
  it("two tabs share the server-reserved idempotency key despite different client UUIDs", async () => {
    mock.attempts.claim.mockResolvedValue(attempt);
    await Promise.all([
      invoke("stripe/create-checkout-session", body),
      invoke("stripe/create-checkout-session", {
        ...body,
        requestId: "22222222-2222-4222-8222-222222222222",
      }),
    ]);
    const calls = mock.stripe.checkout.sessions.create.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][1].idempotencyKey).toBe(calls[1][1].idempotencyKey);
    expect(calls[0][0].expires_at).toBe(calls[1][0].expires_at);
  });
  it("provider subscription with a delayed local webhook opens portal instead of another checkout", async () => {
    mock.stripe.subscriptions.list.mockResolvedValue({
      data: [subscription],
      has_more: false,
    });
    expect(
      await (await invoke("stripe/create-checkout-session", body)).json(),
    ).toHaveProperty("portalUrl");
    expect(mock.attempts.claim).not.toHaveBeenCalled();
    expect(mock.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("changing plan while another checkout is pending requires explicit cancellation", async () => {
    mock.attempts.claim.mockResolvedValue({ ...attempt, plan: "elite" });
    expect(
      await (await invoke("stripe/create-checkout-session", body)).json(),
    ).toMatchObject({ code: "CHECKOUT_PENDING" });
    expect(mock.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("open owned checkout is resumed without creating another session", async () => {
    mock.attempts.claim.mockResolvedValue({
      ...attempt,
      sessionId: "cs_existing",
    });
    mock.stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_existing",
      status: "open",
      customer: "cus_test",
      metadata: { uid: "u" },
      url: "https://checkout.stripe.com/c/pay/cs_existing",
    });
    expect(
      await (await invoke("stripe/create-checkout-session", body)).json(),
    ).toHaveProperty("checkoutUrl");
    expect(mock.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("canceling unpaid checkout expires it before releasing the reserved attempt", async () => {
    mock.attempts.read.mockResolvedValue({
      ...attempt,
      sessionId: "cs_existing",
    });
    mock.stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_existing",
      status: "open",
      metadata: { uid: "u" },
    });
    expect(
      (await invoke("stripe/cancel-checkout-session", { userId: "foreign" }))
        .status,
    ).toBe(200);
    expect(mock.attempts.read).toHaveBeenCalledWith("u");
    expect(mock.stripe.checkout.sessions.expire).toHaveBeenCalledWith(
      "cs_existing",
    );
    expect(mock.attempts.release).toHaveBeenCalledWith("u", body.requestId);
  });
  it.each(["complete", "processing"])(
    "a checkout in %s state cannot be released to initiate another payment",
    async (status) => {
      mock.attempts.read.mockResolvedValue({
        ...attempt,
        sessionId: "cs_existing",
      });
      mock.stripe.checkout.sessions.retrieve.mockResolvedValue({
        id: "cs_existing",
        status,
        metadata: { uid: "u" },
      });
      expect((await invoke("stripe/cancel-checkout-session")).status).toBe(409);
      expect(mock.attempts.release).not.toHaveBeenCalled();
    },
  );
  it("foreign pending checkout cannot be resumed or expired", async () => {
    mock.attempts.read.mockResolvedValue({
      ...attempt,
      sessionId: "cs_existing",
    });
    mock.stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_existing",
      status: "open",
      metadata: { uid: "foreign" },
    });
    expect((await invoke("stripe/cancel-checkout-session")).status).toBe(403);
    expect(mock.stripe.checkout.sessions.expire).not.toHaveBeenCalled();
  });
  it("cancellation failure retains the existing attempt", async () => {
    mock.attempts.read.mockResolvedValue({
      ...attempt,
      sessionId: "cs_existing",
    });
    mock.stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_existing",
      status: "open",
      metadata: { uid: "u" },
    });
    mock.stripe.checkout.sessions.expire.mockRejectedValueOnce(
      new Error("Unavailable"),
    );
    expect((await invoke("stripe/cancel-checkout-session")).status).toBe(502);
    expect(mock.attempts.release).not.toHaveBeenCalled();
  });
});

describe("diary analytics route", () => {
  it("unifies confirmed parent references and missing explicit mentions without using profile fact dates", async () => {
    db.reply([
      {
        date: "2025-07-08",
        content: "Mi madre preparó la merienda",
        mentioned_people: ["mi madre"],
      },
      {
        date: "2025-07-12",
        content: "He visto a mi madre",
        mentioned_people: [],
      },
      {
        date: "2025-07-30",
        content: "Su madre, la madre de Vero",
        mentioned_people: ["MAMÁ"],
      },
    ]);
    db.reply([
      {
        id: "p",
        name: "Mamá",
        details: {
          relacion: { entries: [{ value: "madre", date: "2025-01-01" }] },
          detalles: { entries: [{ value: "Un dato", date: "2025-06-01" }] },
        },
      },
    ]);
    db.reply(null);
    const response = await invoke("statistics/analytics", {}, "GET");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.analytics.people).toHaveLength(1);
    expect(body.analytics.people[0]).toMatchObject({
      name: "Mamá",
      count: 3,
      dates: ["2025-07-30", "2025-07-12", "2025-07-08"],
    });
    expect(
      db.calls.find((call) => call.table === "people")?.steps,
    ).toContainEqual(["eq", "user_id", "u"]);
    expect(JSON.stringify(body)).not.toContain("Un dato");
    expect(mock.responses).not.toHaveBeenCalled();
  });

  it("denies free access before fetching entries, cached reports or providers", async () => {
    mock.subscriptions.getUserProfile.mockResolvedValue(profile("free"));
    expect((await invoke("statistics/analytics", {}, "GET")).status).toBe(403);
    expect(db.from).not.toHaveBeenCalled();
    expect(mock.responses).not.toHaveBeenCalled();
    expect(mock.subscriptions.reserveUsage).not.toHaveBeenCalled();
  });
  it("returns owner-scoped aggregates without diary text and without charging quota", async () => {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    db.reply([
      {
        date: today,
        content: "PRIVATE DIARY TEXT",
        mentioned_people: ["Ana", " ana "],
        happiness: null,
      },
    ]);
    db.reply([]);
    db.reply({
      report: { weekSummary: "Saved analysis", instagramQuote: "Saved quote" },
      generated_at: "2026-09-30T12:00:00Z",
    });
    const response = await invoke("statistics/analytics", {}, "GET");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.analytics.entryCount).toBe(1);
    expect(body.analytics.people[0].count).toBe(1);
    expect(body.report.generatedAt).toBe("2026-09-30T12:00:00Z");
    expect(JSON.stringify(body)).not.toContain("PRIVATE DIARY TEXT");
    expect(db.calls[0].steps).toContainEqual(["eq", "user_id", "u"]);
    expect(mock.responses).not.toHaveBeenCalled();
    expect(mock.subscriptions.reserveUsage).not.toHaveBeenCalled();
  });
  it("returns real recent diary dates separately and never creates September 28 scores", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T22:17:00Z"));
    try {
      db.reply([
        { date: "2025-05-28", content: "Old synthetic entry", happiness: 80 },
        { date: "2026-09-30", content: "Day one", happiness: 5, neutral: 85 },
        { date: "2026-10-01", content: "Day two", happiness: 30, neutral: 55 },
        {
          date: "2026-10-02",
          content: "Day three",
          happiness: 20,
          neutral: 65,
        },
      ]);
      db.reply([]);
      db.reply(null);
      const response = await invoke("statistics/analytics", {}, "GET");
      const { analytics } = await response.json();
      expect(analytics.end).toBe("2026-10-03");
      expect(
        analytics.timeline.find((point: any) => point.date === "2026-09-28"),
      ).toBeUndefined();
      for (const [date, happiness] of [
        ["2026-09-30", 5],
        ["2026-10-01", 30],
        ["2026-10-02", 20],
      ])
        expect(
          analytics.timeline.find((point: any) => point.date === date),
        ).toMatchObject({ happiness, samples: 1 });
      expect(db.calls[0].steps).toContainEqual(["eq", "user_id", "u"]);
      expect(mock.responses).not.toHaveBeenCalled();
      expect(mock.subscriptions.reserveUsage).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
  it("fetches diaries beyond the page limit with date cursors and excludes another supplied owner", async () => {
    const start = new Date("2020-01-01T12:00:00Z");
    const page = Array.from({ length: 500 }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      return { date: d.toISOString().slice(0, 10), content: "Diary" };
    });
    db.reply(page);
    db.reply([{ date: "2022-01-01", content: "Extra" }]);
    db.reply([]);
    db.reply(null);
    const route = await load("statistics/analytics");
    const response = await route.GET(
      new Request(
        "http://localhost/api/statistics/analytics?period=all&userId=someone-else",
      ),
    );
    expect((await response.json()).analytics.entryCount).toBe(501);
    expect(db.calls[1].steps).toContainEqual(["gt", "date", page.at(-1)!.date]);
    for (const call of db.calls)
      expect(call.steps).toContainEqual([
        "eq",
        call.table === "diary_entries" ? "user_id" : "user_id",
        "u",
      ]);
  });
  it("invalid periods return 400 without reads; failures do not fabricate an empty dashboard", async () => {
    const route = await load("statistics/analytics");
    expect(
      (
        await route.GET(
          new Request("http://localhost/api/statistics/analytics?period=bad"),
        )
      ).status,
    ).toBe(400);
    expect(db.from).not.toHaveBeenCalled();
    db.reply(null, { message: "private-db-detail" });
    const response = await invoke("statistics/analytics", {}, "GET");
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain(
      "private-db-detail",
    );
  });
  it("bounded period queries include its previous comparison window", async () => {
    const route = await load("statistics/analytics");
    db.reply([]);
    db.reply([]);
    db.reply(null);
    expect(
      (
        await route.GET(
          new Request("http://localhost/api/statistics/analytics?period=30"),
        )
      ).status,
    ).toBe(200);
    expect(db.calls[0].steps.find((s) => s[0] === "gte")).toEqual([
      "gte",
      "date",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    ]);
    expect(mock.responses).not.toHaveBeenCalled();
  });
});

describe("statistics connection excerpts", () => {
  const url =
    "http://localhost/api/statistics/connections?source=Ana&target=Luis&period=all&dates=2025-07-08,2025-07-12";
  const get = async (query = url) =>
    (await load("statistics/connections")).GET(new Request(query));
  it("denies free access before any diary or catalogue reads", async () => {
    mock.subscriptions.getUserProfile.mockResolvedValue(profile("free"));
    expect((await get()).status).toBe(403);
    expect(db.from).not.toHaveBeenCalled();
    expect(mock.responses).not.toHaveBeenCalled();
  });
  it("returns bounded owner-scoped excerpts only after verifying both canonical mentions", async () => {
    db.reply([{ id: "p", name: "Ana", details: {} }]);
    db.reply([
      {
        date: "2025-07-12",
        content: "Recuerdo " + "texto privado ".repeat(30),
        mentioned_people: ["ANA", "Luis"],
        happiness: 0,
        tranquility: 70,
      },
      {
        date: "2025-07-08",
        content: "No incluye a ambos",
        mentioned_people: ["Ana"],
      },
      {
        date: "2025-06-01",
        content: "Fuera de selección",
        mentioned_people: ["Ana", "Luis"],
      },
    ]);
    const response = await get(url + "&userId=other");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]).toMatchObject({
      date: "2025-07-12",
      happiness: 0,
      tranquility: 70,
      stress: null,
    });
    expect(body.entries[0].excerpt.length).toBeLessThanOrEqual(201);
    expect(body.entries[0].excerpt).toMatch(/…$/);
    for (const call of db.calls)
      expect(call.steps).toContainEqual(["eq", "user_id", "u"]);
    expect(db.calls[1].steps).toContainEqual([
      "in",
      "date",
      ["2025-07-08", "2025-07-12"],
    ]);
    expect(mock.subscriptions.reserveUsage).not.toHaveBeenCalled();
  });
  it.each([
    "source=Ana&target=Ana&dates=2025-07-08",
    "source=Ana&target=Luis&dates=2025-02-30",
    "source=Ana&target=Luis&dates=2999-01-01",
    "source=Ana&target=Luis&period=7&dates=2020-01-01",
    "source=Ana&target=Luis&dates=",
    "source=Ana&target=Luis&period=bad&dates=2025-07-08",
    "source=Ana&target=Luis&dates=" +
      Array.from(
        { length: 13 },
        (_, i) => `2025-07-${String(i + 1).padStart(2, "0")}`,
      ).join(","),
  ])(
    "rejects invalid pair/date selections without reads: %s",
    async (params) => {
      expect(
        (await get("http://localhost/api/statistics/connections?" + params))
          .status,
      ).toBe(400);
      expect(db.from).not.toHaveBeenCalled();
    },
  );
  it("uses confirmed parent references consistently with the connection graph", async () => {
    db.reply([
      {
        id: "p",
        name: "Mamá",
        details: {
          relacion: { entries: [{ value: "madre", date: "2025-01-01" }] },
        },
      },
    ]);
    db.reply([
      {
        date: "2025-07-08",
        content: "Mi madre preparó la merienda",
        mentioned_people: ["Ana"],
      },
    ]);
    const response = await get(url.replace("target=Luis", "target=Mam%C3%A1"));
    expect((await response.json()).entries).toHaveLength(1);
  });
  it("does not leak provider or database errors or fabricate successful empty results", async () => {
    db.reply(null, { message: "secret-db-error" });
    const response = await get();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain(
      "secret-db-error",
    );
  });
});

describe("person emotion rankings", () => {
  const url =
    "http://localhost/api/statistics/person-emotions?person=Ana&emotion=happiness&period=all";
  const get = async (query = url) =>
    (await load("statistics/person-emotions")).GET(new Request(query));
  const entry = (date: string, happiness: number, names = ["Ana"]) => ({
    date,
    happiness,
    tranquility: 40,
    stress: null,
    sadness: 0,
    content: "A private diary memory",
    mentioned_people: names,
  });
  it("denies free plans before reading and never charges or calls a model", async () => {
    mock.subscriptions.getUserProfile.mockResolvedValue(profile("free"));
    expect((await get()).status).toBe(403);
    expect(db.from).not.toHaveBeenCalled();
    expect(mock.responses).not.toHaveBeenCalled();
    expect(mock.subscriptions.reserveUsage).not.toHaveBeenCalled();
  });
  it.each([
    "person=&emotion=happiness",
    "person=Ana&emotion=content",
    "person=Ana&emotion=happiness&period=bad",
    "person=Ana&emotion=happiness&cursor=101|2025-01-01",
    "person=Ana&emotion=happiness&cursor=80|2025-02-30",
    "person=Ana&emotion=happiness&cursor=80|2999-01-01",
    "person=Ana&emotion=happiness&cursor=80),user_id.eq.other",
    "person=Ana&emotion=happiness&period=7&cursor=80|2020-01-01",
  ])("rejects invalid ranking parameters before reads: %s", async (params) => {
    expect(
      (await get("http://localhost/api/statistics/person-emotions?" + params))
        .status,
    ).toBe(400);
    expect(db.from).not.toHaveBeenCalled();
  });
  it("ranks the entire requested period including old high scores, ties by date, real zero and partial scores without content", async () => {
    db.reply([]);
    db.reply([
      entry("2020-01-01", 95),
      entry("2025-07-12", 80, ["Other"]),
      entry("2025-07-11", 80, ["ANA"]),
      entry("2025-07-10", 80),
      entry("2025-07-09", 0),
    ]);
    const response = await get(url + "&userId=foreign");
    const body = await response.json();
    expect(body.entries.map((item: any) => item.date)).toEqual([
      "2020-01-01",
      "2025-07-11",
      "2025-07-10",
      "2025-07-09",
    ]);
    expect(body.entries.at(-1)).toMatchObject({
      happiness: 0,
      stress: null,
      sadness: 0,
    });
    expect(body.nextCursor).toBeNull();
    expect(JSON.stringify(body)).not.toContain("private diary");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    for (const call of db.calls)
      expect(call.steps).toContainEqual(["eq", "user_id", "u"]);
    expect(db.calls[1].steps).toContainEqual([
      "order",
      "happiness",
      { ascending: false },
    ]);
    expect(db.calls[1].steps).toContainEqual([
      "order",
      "date",
      { ascending: false },
    ]);
  });
  it("ranks neutral for the verified owner with real zero and nullable other emotions", async () => {
    db.reply([]);
    db.reply([
      { ...entry("2026-09-29", 0), neutral: 95, tranquility: null },
      { ...entry("2026-09-28", 80), neutral: 0 },
    ]);
    const response = await get(
      url.replace("emotion=happiness", "emotion=neutral") + "&userId=foreign",
    );
    const body = await response.json();
    expect(body.entries.map((item: any) => item.neutral)).toEqual([95, 0]);
    expect(body.entries[0].tranquility).toBeNull();
    expect(db.calls[1].steps).toContainEqual(["eq", "user_id", "u"]);
    expect(db.calls[1].steps).toContainEqual([
      "order",
      "neutral",
      { ascending: false },
    ]);
    expect(db.calls[1].steps).toContainEqual(["gte", "neutral", 0]);
    expect(mock.responses).not.toHaveBeenCalled();
    expect(mock.subscriptions.reserveUsage).not.toHaveBeenCalled();
  });
  it("caps the page at twelve and resumes strictly after score/date without dropping ties", async () => {
    db.reply([]);
    db.reply(
      Array.from({ length: 13 }, (_, i) =>
        entry(`2025-07-${String(20 - i).padStart(2, "0")}`, 80),
      ),
    );
    const body = await (await get()).json();
    expect(body.entries).toHaveLength(12);
    expect(body.nextCursor).toBe("80|2025-07-09");
    db.reply([]);
    db.reply([entry("2025-07-08", 80)]);
    const next = await (
      await get(url + "&cursor=" + encodeURIComponent(body.nextCursor))
    ).json();
    expect(next.entries).toHaveLength(1);
    expect(db.calls.at(-1)?.steps).toContainEqual([
      "or",
      "happiness.lt.80,and(happiness.eq.80,date.lt.2025-07-09)",
    ]);
  });
  it("bounds scans for rare mentions and gives a continuation rather than silently truncating history", async () => {
    db.reply([]);
    const rows = Array.from({ length: 200 }, (_, i) =>
      entry(
        new Date(Date.UTC(2025, 0, 200 - i)).toISOString().slice(0, 10),
        80,
        ["Other"],
      ),
    );
    db.reply(rows.slice(0, 100));
    db.reply(rows.slice(100));
    const body = await (await get()).json();
    expect(body.entries).toEqual([]);
    expect(body.nextCursor).toBe("80|2025-01-01");
    expect(
      db.calls.filter((call) => call.table === "diary_entries"),
    ).toHaveLength(2);
  });
  it("recovers canonical parent mentions and reports database failures safely", async () => {
    db.reply([
      {
        id: "m",
        name: "Mamá",
        details: {
          relacion: { entries: [{ value: "madre", date: "2020-01-01" }] },
        },
      },
    ]);
    db.reply([
      { ...entry("2025-07-08", 80, []), content: "Mi madre vino a verme" },
    ]);
    expect(
      (await (await get(url.replace("person=Ana", "person=Mam%C3%A1"))).json())
        .entries,
    ).toHaveLength(1);
    db.reply(null, { message: "secret failure" });
    const response = await get();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain(
      "secret failure",
    );
  });
});
