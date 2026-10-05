import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDatabase } from "./helpers/database";
const mock = vi.hoisted(() => ({
  user: vi.fn(),
  database: vi.fn(),
  mail: vi.fn(),
}));
vi.mock("@/lib/api-auth", () => ({ getRequestUser: mock.user }));
vi.mock("@/lib/supabase", () => ({ getDatabaseClient: mock.database }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mock.mail };
  },
}));
import { GET as overview } from "@/app/api/dashboard/overview/route";
import { GET as users } from "@/app/api/dashboard/users/route";
import {
  GET as reports,
  PATCH as update,
} from "@/app/api/dashboard/feedback/route";
import { POST as submit } from "@/app/api/send-feedback/route";
import { NextRequest } from "next/server";
const db = mockDatabase(),
  uid = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222";
const request = (path = "", body?: unknown, method = "GET") =>
  new NextRequest(`http://localhost:3200/api/${path}`, {
    method,
    headers: {
      Authorization: "Bearer checked",
      "Content-Type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
beforeEach(() => {
  db.reset();
  db.rpc.mockReset();
  mock.user.mockReset().mockResolvedValue({ uid, email: "real@test.invalid" });
  mock.database.mockReturnValue(db);
  mock.mail
    .mockReset()
    .mockResolvedValue({ data: { id: "email" }, error: null });
});
const allow = () => db.reply({ admin: true });
describe("administration authorization", () => {
  it.each([overview, users, reports, update])(
    "rejects unauthenticated requests before reading anything",
    async (route) => {
      mock.user.mockResolvedValue(null);
      const response = await route(request());
      expect(response.status).toBe(401);
      expect(db.calls).toHaveLength(0);
    },
  );
  it.each([overview, users, reports, update])(
    "rejects members before cross-owner query",
    async (route) => {
      db.reply({ admin: false });
      expect((await route(request())).status).toBe(403);
      expect(db.rpc).not.toHaveBeenCalled();
      expect(db.calls).toEqual([
        {
          table: "profiles",
          steps: [["select", "admin"], ["eq", "uid", uid], ["maybeSingle"]],
        },
      ]);
    },
  );
  it.each([null, { admin: "true" }, { admin: 1 }, {}])(
    "requires a real boolean in the database, not metadata",
    async (data) => {
      db.reply(data);
      expect((await overview(request())).status).toBe(403);
      expect(db.rpc).not.toHaveBeenCalled();
    },
  );
  it("fails closed if flag cannot be read", async () => {
    db.reply(null, { message: "down" });
    expect((await overview(request())).status).toBe(503);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("rechecks database flag on every request, including revocation", async () => {
    allow();
    db.reply({ users: 2 });
    expect((await overview(request())).status).toBe(200);
    db.reply({ admin: false });
    expect((await users(request())).status).toBe(403);
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });
  it("derives actor from verified token and disables private caching", async () => {
    allow();
    db.reply({ users: 2 });
    const response = await overview(
      request("dashboard/overview?userId=forged"),
    );
    expect(response.status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith("admin_overview", { p_actor: uid });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Authorization");
  });
});
describe("admin filters and triage", () => {
  it("a permission revoked between the route and RPC removes access", async () => {
    allow();
    db.reply(null, { code: "42501" });
    expect((await overview(request())).status).toBe(403);
  });
  it.each([
    "page=0",
    "page=-1",
    "page=1e2",
    "page=100001",
    "plan=hacked",
    "q=" + encodeURIComponent("x".repeat(101)),
    "id=not-a-uuid",
  ])("rejects invalid user filter %s", async (query) => {
    allow();
    expect((await users(request("dashboard/users?" + query))).status).toBe(400);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("paginates selected effective plan and literal search", async () => {
    allow();
    db.reply({ items: [], total: 0 });
    expect(
      (await users(request("dashboard/users?plan=elite&q=Ana%25&page=2")))
        .status,
    ).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith("admin_users", {
      p_actor: uid,
      p_query: "Ana%",
      p_plan: "elite",
      p_page: 2,
    });
  });
  it("loads selected user on demand", async () => {
    allow();
    db.reply({ uid: id, email: "member@test.invalid" });
    expect((await users(request("dashboard/users?id=" + id))).status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith("admin_user_detail", {
      p_actor: uid,
      p_user_id: id,
    });
  });
  it("returns 404 for missing account", async () => {
    allow();
    db.reply(null);
    expect((await users(request("dashboard/users?id=" + id))).status).toBe(404);
  });
  it.each(["type=invalid", "status=invalid", "page=0"])(
    "rejects report filters %s",
    async (query) => {
      allow();
      expect(
        (await reports(request("dashboard/feedback?" + query))).status,
      ).toBe(400);
      expect(db.rpc).not.toHaveBeenCalled();
    },
  );
  it("filters suggestions by workflow state", async () => {
    allow();
    db.reply({ items: [], total: 0 });
    expect(
      (
        await reports(
          request("dashboard/feedback?type=suggestion&status=resolved&page=3"),
        )
      ).status,
    ).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith("admin_feedback", {
      p_actor: uid,
      p_query: "",
      p_type: "suggestion",
      p_status: "resolved",
      p_page: 3,
    });
  });
  const body = {
    id,
    status: "resolved",
    priority: "high",
    notes: "Checked",
    version: "2026-10-02T00:00:00.123456Z",
  };
  it.each([
    { ...body, id: "wrong" },
    { ...body, status: "admin" },
    { ...body, priority: "critical" },
    { ...body, notes: "x".repeat(5001) },
    { ...body, version: "bad" },
    { ...body, version: null },
    null,
  ])("rejects invalid triage %#", async (payload) => {
    allow();
    expect((await update(request("", payload, "PATCH"))).status).toBe(400);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it.each([
    [{ conflict: true }, 409],
    [{ missing: true }, 404],
    [{ saved: true }, 200],
  ] as const)("handles atomic triage result %j", async (data, status) => {
    allow();
    db.reply(data);
    expect((await update(request("", body, "PATCH"))).status).toBe(status);
    expect(db.rpc).toHaveBeenCalledWith("admin_update_feedback", {
      p_actor: uid,
      p_id: id,
      p_status: "resolved",
      p_priority: "high",
      p_notes: "Checked",
      p_version: body.version,
    });
  });
  it("does not expose database diagnostics", async () => {
    allow();
    db.reply(null, { message: "secret internal query" });
    const response = await users(request());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});
describe("durable feedback", () => {
  it("uses verified owner and persists before optional email", async () => {
    db.reply({ allowed: true, id, duplicate: false });
    const response = await submit(
      request(
        "send-feedback",
        { type: "problem", message: "  Fallo  ", userId: "forged" },
        "POST",
      ),
    );
    expect(await response.json()).toMatchObject({
      success: true,
      saved: true,
      id,
    });
    expect(db.rpc).toHaveBeenCalledWith("submit_feedback", {
      p_user_id: uid,
      p_fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
      p_type: "problem",
      p_message: "Fallo",
    });
    expect(mock.mail).toHaveBeenCalledTimes(1);
  });
  it("does not notify when the database failed", async () => {
    db.reply(null, { message: "down" });
    expect(
      (
        await submit(
          request("", { type: "suggestion", message: "Idea" }, "POST"),
        )
      ).status,
    ).toBe(503);
    expect(mock.mail).not.toHaveBeenCalled();
  });
  it("saves with no Resend configuration", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    db.reply({ allowed: true, id });
    try {
      const response = await submit(
        request("", { type: "suggestion", message: "Idea" }, "POST"),
      );
      expect(await response.json()).toMatchObject({
        saved: true,
        notified: false,
      });
      expect(mock.mail).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("saved message remains successful when mail rejects", async () => {
    db.reply({ allowed: true, id });
    mock.mail.mockRejectedValue(new Error("down"));
    const response = await submit(
      request("", { type: "suggestion", message: "Idea" }, "POST"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      saved: true,
      notified: false,
    });
  });
  it("enforces hourly rate before email", async () => {
    db.reply({ allowed: false });
    expect(
      (
        await submit(
          request("", { type: "problem", message: "Repeated" }, "POST"),
        )
      ).status,
    ).toBe(429);
    expect(mock.mail).not.toHaveBeenCalled();
  });
  it("does not accept forged sender email", async () => {
    expect(
      (
        await submit(
          request(
            "",
            {
              type: "problem",
              message: "Error",
              userEmail: "forged@test.invalid",
            },
            "POST",
          ),
        )
      ).status,
    ).toBe(403);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("retains the same fingerprint for a retry within the same hour", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T09:05:00Z"));
    db.reply({ allowed: true, id });
    db.reply({ allowed: true, id, duplicate: true });
    try {
      await submit(request("", { type: "problem", message: "Same" }, "POST"));
      await submit(request("", { type: "problem", message: "Same" }, "POST"));
      expect(db.rpc.mock.calls[0][1].p_fingerprint).toBe(
        db.rpc.mock.calls[1][1].p_fingerprint,
      );
    } finally {
      vi.useRealTimers();
    }
  });
  it("rejects malformed JSON without database writes", async () => {
    const response = await submit(
      new NextRequest("http://localhost/api/send-feedback", {
        method: "POST",
        body: "{",
      }),
    );
    expect(response.status).toBe(400);
    expect(db.rpc).not.toHaveBeenCalled();
  });
});
