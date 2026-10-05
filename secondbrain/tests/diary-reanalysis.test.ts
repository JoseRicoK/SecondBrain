import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDatabase } from "./helpers/database";
const mock = vi.hoisted(() => ({
  user: vi.fn(),
  database: vi.fn(),
  mood: vi.fn(),
  people: vi.fn(),
}));
vi.mock("@/lib/api-auth", () => ({ getRequestUser: mock.user }));
vi.mock("@/lib/supabase", () => ({ getDatabaseClient: mock.database }));
vi.mock("@/lib/diary-analysis", () => ({
  analyzeDiaryMood: mock.mood,
  extractDiaryPeople: mock.people,
}));
import { GET, POST } from "@/app/api/dashboard/reanalysis/route";
import { processReanalysis } from "@/lib/diary-reanalysis";
const db = mockDatabase();
const actor = "11111111-1111-4111-8111-111111111111",
  owner = "22222222-2222-4222-8222-222222222222",
  jobId = "33333333-3333-4333-8333-333333333333",
  entryId = "44444444-4444-4444-8444-444444444444";
const request = (body?: unknown) =>
  new Request("http://localhost/api/dashboard/reanalysis?userId=" + owner, {
    method: body === undefined ? "GET" : "POST",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
const job = {
  id: jobId,
  userId: owner,
  status: "running",
  pending: 2,
  done: 0,
  failed: 0,
  total: 2,
};
const claim = {
  entryId,
  userId: owner,
  date: "2026-01-01",
  text: "Texto ficticio privado",
  includePeople: false,
  token: "lease",
};
const mood = {
  happiness: 0,
  tranquility: null,
  stress: 0,
  sadness: 0,
  neutral: 90,
};
beforeEach(() => {
  db.reset();
  mock.user.mockReset().mockResolvedValue({ uid: actor });
  mock.database.mockReturnValue(db);
  mock.mood.mockReset().mockResolvedValue(mood);
  mock.people.mockReset().mockResolvedValue([]);
});
describe("admin reanalysis boundary", () => {
  it.each([GET, POST])(
    "requires authentication before SQL/AI",
    async (handler) => {
      mock.user.mockResolvedValue(null);
      expect((await handler(request({ action: "start" }))).status).toBe(401);
      expect(db.from).not.toHaveBeenCalled();
      expect(mock.mood).not.toHaveBeenCalled();
    },
  );
  it.each([GET, POST])("checks fresh admin before SQL/AI", async (handler) => {
    db.reply({ admin: false });
    expect((await handler(request({ action: "start" }))).status).toBe(403);
    expect(db.rpc).not.toHaveBeenCalled();
    expect(mock.mood).not.toHaveBeenCalled();
  });
  it("reads counts without running providers or returning content", async () => {
    db.reply({ admin: true });
    db.reply({ eligible: 2, peoplePending: 1, job });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith("admin_reanalysis_status", {
      p_actor: actor,
      p_user_id: owner,
    });
    expect(mock.mood).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toContain(claim.text);
  });
  it.each([
    null,
    { action: "unknown" },
    { action: "start", userId: owner, requestId: "invalid" },
    { action: "process", jobId: "invalid" },
  ])("rejects malformed actions %#", async (body) => {
    db.reply({ admin: true });
    expect((await POST(request(body))).status).toBe(400);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("uses verified actor, target and idempotency UUID for start", async () => {
    db.reply({ admin: true });
    db.reply(job);
    const response = await POST(
      request({
        action: "start",
        userId: owner,
        requestId: entryId,
        actorId: owner,
        text: "forged",
      }),
    );
    expect(response.status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith("admin_start_reanalysis", {
      p_actor: actor,
      p_user_id: owner,
      p_request_id: entryId,
    });
    expect(mock.people).not.toHaveBeenCalled();
  });
  it("revocation inside SQL fails without AI or diagnostics", async () => {
    db.reply({ admin: true });
    db.reply(null, { code: "42501", message: "internal query" });
    const response = await POST(request({ action: "process", jobId }));
    expect(response.status).toBe(403);
    expect(JSON.stringify(await response.json())).not.toContain("internal");
    expect(mock.mood).not.toHaveBeenCalled();
  });
  it.each(["retry", "cancel"])(
    "controls jobs without provider calls: %s",
    async (action) => {
      db.reply({ admin: true });
      db.reply(job);
      expect((await POST(request({ action, jobId }))).status).toBe(200);
      expect(db.rpc).toHaveBeenCalledWith("admin_control_reanalysis", {
        p_actor: actor,
        p_job_id: jobId,
        p_action: action,
      });
      expect(mock.mood).not.toHaveBeenCalled();
    },
  );
});
describe("one entry worker", () => {
  it("busy/completed job does not spend AI or expose leases", async () => {
    db.reply({ job, busy: true });
    expect(await processReanalysis(db as any, actor, jobId)).toEqual({
      job,
      busy: true,
    });
    expect(mock.mood).not.toHaveBeenCalled();
  });
  it("recalculates existing emotions without reading/writing people", async () => {
    db.reply({ job, claim });
    db.reply({ job: { ...job, done: 1, pending: 1 } });
    const result = await processReanalysis(db as any, actor, jobId);
    expect(mock.mood).toHaveBeenCalledWith(claim.text);
    expect(mock.people).not.toHaveBeenCalled();
    expect(db.from).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenLastCalledWith(
      "admin_finish_reanalysis",
      expect.objectContaining({
        p_actor: actor,
        p_job_id: jobId,
        p_entry_id: entryId,
        p_token: claim.token,
        p_mood: mood,
        p_people: null,
      }),
    );
    expect(JSON.stringify(result)).not.toContain(claim.text);
    expect(JSON.stringify(result)).not.toContain(claim.token);
  });
  it("provider failure preserves prior values and records retryable failure", async () => {
    db.reply({ job, claim });
    db.reply({ job });
    mock.mood.mockRejectedValue(new Error("secret provider key"));
    await processReanalysis(db as any, actor, jobId);
    expect(db.rpc).toHaveBeenLastCalledWith(
      "admin_finish_reanalysis",
      expect.objectContaining({
        p_mood: null,
        p_people: null,
        p_error: "provider",
      }),
    );
    expect(JSON.stringify(db.calls)).not.toContain("secret");
  });
  it("merges pending people and rebases a concurrent edit without repeating AI", async () => {
    const ana = {
      id: entryId,
      name: "Ana",
      updated_at: "2026-01-01T00:00:00Z",
      details: {
        relacion: { entries: [{ value: "Amiga", date: "2026-01-01" }] },
      },
    };
    db.reply({ job, claim: { ...claim, includePeople: true } });
    db.reply([ana]);
    db.reply([ana]);
    db.reply({ job, conflict: true });
    db.reply([
      {
        ...ana,
        updated_at: "2026-01-02T00:00:00Z",
        details: {
          ...ana.details,
          detalles: { entries: [{ value: "Dato manual", date: "2026-01-01" }] },
        },
      },
    ]);
    db.reply({ job });
    mock.people.mockResolvedValue([
      {
        name: "Ana",
        information: { relacion: "amiga", detalles: ["Fui a su casa"] },
      },
    ]);
    await processReanalysis(db as any, actor, jobId);
    expect(mock.people).toHaveBeenCalledTimes(1);
    expect(mock.mood).toHaveBeenCalledTimes(1);
    const writes = db.rpc.mock.calls.filter(
      (call) => call[0] === "admin_finish_reanalysis",
    );
    expect(writes[1][1].p_people[0]).toMatchObject({
      id: entryId,
      name: "Ana",
      version: "2026-01-02T00:00:00Z",
      details: {
        relacion: { entries: [{ value: "Amiga", date: "2026-01-01" }] },
        detalles: {
          entries: [
            { value: "Dato manual", date: "2026-01-01" },
            { value: "Fui a su casa", date: "2026-01-01" },
          ],
        },
      },
    });
    expect(
      db.calls
        .filter((call) => call.table === "people")
        .every((call) =>
          call.steps.some(
            (step) =>
              step[0] === "eq" && step[1] === "user_id" && step[2] === owner,
          ),
        ),
    ).toBe(true);
  });
  it("stale completion returns safe summary without another model call", async () => {
    db.reply({ job, claim });
    db.reply({ job, stale: true });
    expect(await processReanalysis(db as any, actor, jobId)).toEqual({
      job,
      stale: true,
    });
    expect(mock.mood).toHaveBeenCalledTimes(1);
  });
});
