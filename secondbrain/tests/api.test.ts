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
      "getEntriesMoodDataByDateRange",
      "getEntryByIdForUser",
      "saveExtractedPersonInfo",
      "incrementPersonMentionCount",
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
    stripe: {
      prices: { retrieve: vi.fn() },
      customers: { create: vi.fn() },
      billingPortal: { sessions: { create: vi.fn() } },
      checkout: { sessions: { create: vi.fn(), retrieve: vi.fn() } },
      subscriptions: { update: vi.fn(), retrieve: vi.fn() },
      webhooks: { constructEvent: vi.fn() },
      invoices: { retrieve: vi.fn() },
    },
  };
});
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
  mock.stripe.prices.retrieve.mockReset();
  mock.stripe.prices.retrieve.mockImplementation(async (id: string) => ({
    active: true,
    currency: "eur",
    unit_amount: id === "price_elite" ? 1999 : 999,
    recurring: { interval: "month", interval_count: 1 },
  }));
  mock.stripe.billingPortal.sessions.create.mockReset();
  mock.stripe.billingPortal.sessions.create.mockResolvedValue({
    url: "https://billing.stripe.com/p/session/fixture",
  });
  mock.stripe.customers.create.mockResolvedValue({ id: "cus_test" });
  mock.stripe.checkout.sessions.create.mockResolvedValue({ id: "cs_test" });
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
  ["statistics/summary", "GET"],
  ["statistics/quote", "GET"],
  ["statistics/people", "GET"],
  ["statistics/mood", "GET"],
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
        person: { name: "Ana", user_id: "u" },
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
            person: { name: "Ana", details: {} },
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
        (await invoke(path, { userId: "u", person: { name: "Ana" } })).status,
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
      expect(mock.data.incrementPersonMentionCount).toHaveBeenCalledWith(
        "u",
        "Ana",
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
  it("clamps mood scores to 0–100 and rounds them", async () => {
    mock.responses
      .mockResolvedValueOnce({ output_text: "[]" })
      .mockResolvedValueOnce({
        output_text:
          '{"happiness":130,"stress":-20,"tranquility":34.8,"sadness":0}',
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
    db.rpc.mockResolvedValue({ data: false, error: null });
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
  it("reports mail provider failure without claiming success", async () => {
    mock.sendEmail.mockResolvedValue({ error: { message: "failed" } });
    expect(
      (
        await invoke("send-feedback", {
          type: "suggestion",
          message: "Hola",
          userEmail: "u@test.invalid",
        })
      ).status,
    ).toBe(500);
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
  it("mismatched Stripe currency cannot create a charge", async () => {
    mock.stripe.prices.retrieve.mockResolvedValue({
      active: true,
      currency: "usd",
      unit_amount: 999,
      recurring: { interval: "month", interval_count: 1 },
    });
    expect(
      (
        await invoke("stripe/create-checkout-session", {
          userId: "u",
          userEmail: "u@test.invalid",
          planType: "pro",
          requestId: "11111111-1111-4111-8111-111111111111",
        })
      ).status,
    ).toBe(500);
    expect(mock.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
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
      expect(await result.json()).toEqual({ sessionId: "cs_test" });
      expect(mock.stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "subscription",
          line_items: [{ price: `price_${planType}`, quantity: 1 }],
          success_url:
            "http://localhost:3100/dashboard?session_id={CHECKOUT_SESSION_ID}",
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
