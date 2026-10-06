import { beforeEach, expect, it, vi } from "vitest";
import { mockDatabase } from "./helpers/database";
const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  people: vi.fn(),
  extract: vi.fn(),
  mood: vi.fn(),
  db: vi.fn(),
  auth: vi.fn(),
  entry: vi.fn(),
}));
vi.mock("@vercel/queue", () => ({ send: mocks.send }));
vi.mock("@/lib/supabase", () => ({ getDatabaseClient: mocks.db }));
vi.mock("@/lib/diary-reanalysis", () => ({ readAnalysisPeople: mocks.people }));
vi.mock("@/lib/diary-analysis", () => ({
  extractDiaryPeople: mocks.extract,
  analyzeDiaryMood: mocks.mood,
}));
vi.mock("@/lib/api-auth", () => ({ getRequestUser: mocks.auth }));
vi.mock("@/lib/supabase-operations", () => ({
  getEntryByIdForUser: mocks.entry,
}));
import {
  processAnalysisJob,
  publishAnalysisJob,
  getAnalysisJob,
  type AnalysisJob,
  publicAnalysisJob,
} from "@/lib/diary-analysis-jobs";
import { GET, POST } from "@/app/api/diary-analysis/route";
const db = mockDatabase();
const job = {
  id: "10000000-0000-4000-8000-000000000001",
  entry_id: "20000000-0000-4000-8000-000000000001",
  user_id: "owner",
  generation: "30000000-0000-4000-8000-000000000001",
  status: "queued",
  published_generation: null,
} as AnalysisJob;
const claim = {
  entryId: job.entry_id,
  userId: "owner",
  text: "Vi a Ana, mi amiga.",
  date: "2026-10-06",
  token: "lease",
};
beforeEach(() => {
  db.reset();
  mocks.db.mockReturnValue(db);
  mocks.send.mockReset().mockResolvedValue({ messageId: "message" });
  mocks.people.mockReset().mockResolvedValue([]);
  mocks.extract
    .mockReset()
    .mockResolvedValue([
      { id: null, name: "Ana", information: { relacion: "amiga" } },
    ]);
  mocks.mood.mockReset().mockResolvedValue({
    happiness: 50,
    tranquility: 20,
    stress: null,
    sadness: 0,
    neutral: 10,
  });
  mocks.auth.mockReset().mockResolvedValue({ uid: "owner" });
  mocks.entry
    .mockReset()
    .mockResolvedValue({ id: job.entry_id, content: claim.text });
});
it("ignores duplicate, superseded or deleted deliveries without calling the provider", async () => {
  db.reply(null);
  await processAnalysisJob(job.id, job.generation);
  expect(mocks.extract).not.toHaveBeenCalled();
  expect(mocks.mood).not.toHaveBeenCalled();
});
it("retries a busy lease without making another provider request", async () => {
  db.reply({ busy: true });
  await expect(processAnalysisJob(job.id, job.generation)).rejects.toThrow(
    "already running",
  );
  expect(mocks.extract).not.toHaveBeenCalled();
});
it("atomically persists people and mood after a validated claim", async () => {
  db.reply(claim);
  db.reply({ done: true });
  await processAnalysisJob(job.id, job.generation);
  expect(mocks.extract).toHaveBeenCalledWith(claim.text, claim.date, []);
  expect(db.rpc.mock.calls[1]).toEqual([
    "finish_diary_analysis",
    expect.objectContaining({
      p_generation: job.generation,
      p_token: "lease",
      p_mood: expect.objectContaining({ stress: null }),
      p_people: [expect.objectContaining({ name: "Ana", version: null })],
    }),
  ]);
});
it("rebases conflicting person versions without calling AI twice", async () => {
  db.reply(claim);
  db.reply({ conflict: true });
  db.reply({ done: true });
  await processAnalysisJob(job.id, job.generation);
  expect(mocks.extract).toHaveBeenCalledOnce();
  expect(mocks.mood).toHaveBeenCalledOnce();
  expect(db.rpc).toHaveBeenCalledTimes(3);
});
it("records provider failure and lets the queue retry only when the database allows it", async () => {
  db.reply(claim);
  db.reply({ retry: true });
  mocks.extract.mockRejectedValue(new Error("provider"));
  await expect(processAnalysisJob(job.id, job.generation)).rejects.toThrow(
    "temporarily unavailable",
  );
  expect(db.rpc.mock.calls[1][1]).toMatchObject({
    p_error: "provider",
    p_people: null,
    p_mood: null,
  });
  expect(mocks.mood).not.toHaveBeenCalled();
});
it("sends IDs only, deduplicates generation and skips published work", async () => {
  await publishAnalysisJob(job);
  expect(mocks.send).toHaveBeenCalledWith(
    "diary-analysis",
    { jobId: job.id, generation: job.generation },
    expect.objectContaining({
      idempotencyKey: job.generation,
      delaySeconds: 10,
    }),
  );
  await publishAnalysisJob({ ...job, published_generation: job.generation });
  expect(mocks.send).toHaveBeenCalledOnce();
});
it("leaves publication failures retryable", async () => {
  mocks.send.mockRejectedValue(new Error("offline"));
  await expect(publishAnalysisJob(job)).rejects.toThrow("offline");
  expect(db.from).not.toHaveBeenCalled();
});
it("always scopes job reads to the verified owner", async () => {
  db.reply(null);
  await getAnalysisJob(job.entry_id, "owner");
  expect(db.calls[0].steps).toContainEqual(["eq", "user_id", "owner"]);
});
it.each([GET, POST])(
  "rejects anonymous status/retry before reading entries",
  async (handler) => {
    mocks.auth.mockResolvedValue(null);
    expect(
      (await handler(new Request("https://app.test/api/diary-analysis")))
        .status,
    ).toBe(401);
    expect(mocks.entry).not.toHaveBeenCalled();
  },
);
it("cannot enqueue another owner's diary entry", async () => {
  mocks.entry.mockResolvedValue(null);
  const response = await POST(
    new Request("https://app.test/api/diary-analysis", {
      method: "POST",
      body: JSON.stringify({ entryId: job.entry_id }),
    }),
  );
  expect(response.status).toBe(404);
  expect(mocks.entry).toHaveBeenCalledWith(job.entry_id, "owner");
  expect(db.rpc).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
});
it("returns a saved entry only after the owned job completes", async () => {
  db.reply({ ...job, status: "done" });
  const response = await GET(
    new Request(`https://app.test/api/diary-analysis?entryId=${job.entry_id}`),
  );
  expect(await response.json()).toMatchObject({
    analysis: { status: "done" },
    entry: { content: claim.text },
  });
  expect(mocks.send).not.toHaveBeenCalled();
});

it("retains the ambiguous mention and does not save partial people or mood", async () => {
  const { AmbiguousPersonError } = await import("@/lib/person-identity");
  db.reply(claim);
  db.reply({ retry: false });
  mocks.extract.mockRejectedValue(new AmbiguousPersonError("Teresa"));
  await processAnalysisJob(job.id, job.generation);
  expect(db.rpc.mock.calls[1][1]).toMatchObject({
    p_error: "ambiguous",
    p_people: { ambiguousPersonName: "Teresa" },
    p_mood: null,
  });
  expect(mocks.mood).not.toHaveBeenCalled();
});
it("names an ambiguous mention only for failed jobs and preserves the legacy fallback", () => {
  expect(
    publicAnalysisJob({
      ...job,
      status: "failed",
      error_code: "ambiguous",
      error_person_name: "Teresa",
    })?.error,
  ).toContain("«Teresa»");
  expect(
    publicAnalysisJob({ ...job, status: "failed", error_code: "ambiguous" })
      ?.error,
  ).toContain("Hay una persona");
  expect(
    publicAnalysisJob({
      ...job,
      status: "queued",
      error_code: "ambiguous",
      error_person_name: "Teresa",
    })?.error,
  ).toBeNull();
});
