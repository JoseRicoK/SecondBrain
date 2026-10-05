import { beforeEach, expect, it, vi } from "vitest";
import {
  authEmail,
  AUTH_EMAILS,
  billingEmail,
  feedbackEmail,
} from "@/lib/email-templates";
import { POST } from "@/app/api/emails/process-billing/route";
const mock = vi.hoisted(() => ({
  db: vi.fn(),
  rpc: vi.fn(),
  auth: vi.fn(),
  update: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ getDatabaseClient: mock.db }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mock.send };
  },
}));
beforeEach(() => {
  const query: any = {
    eq: vi.fn(() => query),
    then: (success: any, failure: any) =>
      Promise.resolve({ error: null }).then(success, failure),
  };
  mock.db.mockReturnValue({
    rpc: mock.rpc,
    auth: { admin: { getUserById: mock.auth } },
    from: () => ({ update: mock.update.mockReturnValue(query) }),
  });
  mock.rpc.mockResolvedValue({ data: [], error: null });
  mock.auth.mockResolvedValue({
    data: {
      user: {
        email: "verified@test.invalid",
        email_confirmed_at: "2026-01-01",
      },
    },
    error: null,
  });
  mock.send.mockResolvedValue({ data: { id: "mail" }, error: null });
  vi.stubEnv("CRON_SECRET", "test-cron");
  vi.stubEnv("BILLING_EMAILS_ENABLED", "false");
  vi.stubEnv("RESEND_API_KEY", "re_test");
});
it.each(Object.keys(AUTH_EMAILS) as Array<keyof typeof AUTH_EMAILS>)(
  "auth %s uses Spanish HTML and valid provider placeholders",
  (kind) => {
    const email = authEmail(kind);
    expect(email.subject).toContain("LumaDiary");
    expect(email.html).toContain('lang="es"');
    expect(email.html).toContain('role="presentation"');
    expect(email.html).toContain(
      kind === "reauthentication" ? "{{ .Token }}" : "{{ .ConfirmationURL }}",
    );
    expect(email.html).not.toContain("javascript:");
  },
);
it("feedback escapes user content and supplies plain text", () => {
  const email = feedbackEmail(
    "problem",
    "a@test.invalid",
    "<img src=x onerror=alert(1)>",
    new Date("2026-09-30"),
  );
  expect(email.html).not.toContain("<img");
  expect(email.html).toContain("&lt;img");
  expect(email.text).toContain("<img");
});
it.each([
  ["active", false],
  ["active", true],
  ["past_due", false],
  ["canceled", false],
])(
  "billing %s/%s has actionable content and no private diary",
  (status, cancel) => {
    const email = billingEmail("pro", status, cancel, "2026-12-01");
    expect(email.html).toContain("https://app.lumadiary.com/subscription");
    expect(email.text).toBeTruthy();
  },
);
it("billing mail is disabled even with configured credentials", async () => {
  const response = await POST(
    new Request("http://localhost/api/emails/process-billing", {
      method: "POST",
      headers: { authorization: "Bearer test-cron" },
    }),
  );
  expect(response.status).toBe(503);
  expect(mock.rpc).not.toHaveBeenCalled();
  expect(mock.send).not.toHaveBeenCalled();
});
it("a worker requires the cron secret", async () => {
  vi.stubEnv("BILLING_EMAILS_ENABLED", "true");
  expect(
    (
      await POST(
        new Request("http://localhost/api/emails/process-billing", {
          method: "POST",
        }),
      )
    ).status,
  ).toBe(401);
  expect(mock.send).not.toHaveBeenCalled();
});
it("enabled worker uses verified Auth recipients and stable event idempotency", async () => {
  vi.stubEnv("BILLING_EMAILS_ENABLED", "true");
  mock.rpc.mockResolvedValue({
    data: [
      {
        event_id: "evt_test",
        user_id: "u",
        attempts: 1,
        payload: { plan: "pro", status: "active" },
      },
    ],
    error: null,
  });
  const result = await POST(
    new Request("http://localhost/api/emails/process-billing", {
      method: "POST",
      headers: { authorization: "Bearer test-cron" },
    }),
  );
  expect(await result.json()).toEqual({ processed: 1, sent: 1 });
  expect(mock.send).toHaveBeenCalledWith(
    expect.objectContaining({
      to: ["verified@test.invalid"],
      text: expect.any(String),
    }),
    { idempotencyKey: "billing-evt_test" },
  );
  expect(mock.update).toHaveBeenCalledWith(
    expect.objectContaining({ status: "sent" }),
  );
});
it("failed deliveries remain pending for retry", async () => {
  vi.stubEnv("BILLING_EMAILS_ENABLED", "true");
  mock.rpc.mockResolvedValue({
    data: [
      {
        event_id: "evt_test",
        user_id: "u",
        attempts: 1,
        payload: { plan: "pro", status: "active" },
      },
    ],
    error: null,
  });
  mock.send.mockResolvedValue({ error: new Error("provider unavailable") });
  expect(
    await (
      await POST(
        new Request("http://localhost", {
          method: "POST",
          headers: { authorization: "Bearer test-cron" },
        }),
      )
    ).json(),
  ).toEqual({ processed: 1, sent: 0 });
  expect(mock.update).toHaveBeenCalledWith(
    expect.objectContaining({ status: "pending", lease_until: null }),
  );
});
it("unconfirmed recipients never receive billing emails", async () => {
  vi.stubEnv("BILLING_EMAILS_ENABLED", "true");
  mock.rpc.mockResolvedValue({
    data: [
      {
        event_id: "evt_test",
        user_id: "u",
        attempts: 1,
        payload: { plan: "pro", status: "active" },
      },
    ],
    error: null,
  });
  mock.auth.mockResolvedValue({
    data: { user: { email: "unverified@test.invalid" } },
    error: null,
  });
  await POST(
    new Request("http://localhost", {
      method: "POST",
      headers: { authorization: "Bearer test-cron" },
    }),
  );
  expect(mock.send).not.toHaveBeenCalled();
});
