// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDatabase } from "./helpers/database";
import * as ops from "@/lib/supabase-operations";
import { supabase, getDatabaseClient } from "@/lib/supabase";
vi.mock("@/lib/supabase", () => ({
  getDatabaseClient: vi.fn(),
  supabase: {
    auth: Object.fromEntries(
      [
        "getSession",
        "getUser",
        "signUp",
        "signOut",
        "signInWithPassword",
        "signInWithOAuth",
        "resend",
        "updateUser",
        "resetPasswordForEmail",
      ].map((key) => [key, vi.fn()]),
    ),
  },
}));
const db = mockDatabase();
const auth = supabase.auth as any;
const row = {
  id: "entry",
  user_id: "u",
  date: "2024-02-29",
  content: "Hoy",
  created_at: "2024-02-29T12:00:00Z",
  updated_at: "2024-02-29T12:00:00Z",
};
const person = { ...row, id: "person", name: "Ana", details: {} };
const user = {
  id: "u",
  email: "u@test.invalid",
  email_confirmed_at: "2024-01-01",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { display_name: "Ana" },
};
beforeEach(() => {
  db.reset();
  vi.mocked(getDatabaseClient).mockReturnValue(db as any);
  for (const fn of Object.values(auth) as any[])
    fn.mockReset().mockResolvedValue({ data: {}, error: null });
});
describe("diary, people, audio and mood persistence", () => {
  it("fetches an entry ID only when it belongs to the requested owner", async () => {
    db.reply(row);
    expect(await ops.getEntryByIdForUser("entry", "u")).toMatchObject({
      id: "entry",
    });
    expect(db.calls[0].steps).toContainEqual(["eq", "id", "entry"]);
    expect(db.calls[0].steps).toContainEqual(["eq", "user_id", "u"]);
    db.reply(null);
    expect(await ops.getEntryByIdForUser("foreign", "u")).toBeNull();
  });
  it("fails closed when entry ownership lookup fails", async () => {
    db.reply(null, { message: "offline" });
    await expect(ops.getEntryByIdForUser("e", "u")).rejects.toThrow("offline");
  });
  it.each([
    "32985906-abdf-477d-8ef3-84bba3b80c25",
    "32985906-ABDF-477D-8EF3-84BBA3B80C25",
  ])("accepts UUID %s", (value) => expect(ops.isValidUUID(value)).toBe(true));
  it.each([
    "abc",
    "32985906-abdf-077d-8ef3-84bba3b80c25",
    "32985906-abdf-477d-0ef3-84bba3b80c25",
    "",
  ])("rejects malformed UUID %s", (value) =>
    expect(ops.isValidUUID(value)).toBe(false),
  );
  it("loads an entry by owner and date with safe defaults", async () => {
    db.reply(row);
    expect(await ops.getEntryByDate(row.date, "u")).toMatchObject({
      ...row,
      mentioned_people: [],
    });
    expect(db.calls[0].steps).toContainEqual(["eq", "user_id", "u"]);
    expect(db.calls[0].steps).toContainEqual(["eq", "date", row.date]);
  });
  it.each([null, { message: "denied" }])(
    "returns null on absent or rejected entry",
    async (error) => {
      db.reply(null, error);
      expect(await ops.getEntryByDate(row.date, "u")).toBeNull();
    },
  );
  it("inserts a new entry with its date and owner", async () => {
    db.reply(row);
    await ops.saveEntry({ content: "Hoy", user_id: "u", date: row.date });
    expect(db.calls[0].steps).toContainEqual([
      "insert",
      expect.objectContaining({
        user_id: "u",
        date: row.date,
        content: "Hoy",
        mentioned_people: [],
      }),
    ]);
  });
  it("updates an existing entry without changing its identity or date", async () => {
    db.reply(row);
    await ops.saveEntry({
      ...row,
      content: "Cambio",
      mentioned_people: ["Ana"],
    });
    expect(db.calls[0].steps).toContainEqual([
      "update",
      expect.objectContaining({ content: "Cambio", mentioned_people: ["Ana"] }),
    ]);
    expect(db.calls[0].steps).toContainEqual(["eq", "id", row.id]);
    expect(db.calls[0].steps[0][1]).not.toHaveProperty("user_id");
  });
  it("does not report a failed save as successful", async () => {
    db.reply(null, { message: "denied" });
    expect(await ops.saveEntry(row)).toBeNull();
  });
  it.each([
    [2024, 2, "2024-02-01", "2024-02-29"],
    [2025, 2, "2025-02-01", "2025-02-28"],
    [2026, 12, "2026-12-01", "2026-12-31"],
    [2026, 1, "2026-01-01", "2026-01-31"],
  ])("month boundaries %s/%s", async (year, month, start, end) => {
    db.reply([row]);
    expect(
      await ops.getEntriesByMonth(Number(year), Number(month), "u"),
    ).toHaveLength(1);
    expect(db.calls[0].steps).toContainEqual(["gte", "date", start]);
    expect(db.calls[0].steps).toContainEqual(["lte", "date", end]);
  });
  it("orders all entries and limits ranges to the current owner", async () => {
    db.reply([row]);
    await ops.getDiaryEntriesByUserId("u");
    expect(db.calls[0].steps).toContainEqual([
      "order",
      "date",
      { ascending: false },
    ]);
    db.reply([row]);
    await ops.getEntriesByDateRange("u", "2024-01-01", "2024-12-31");
    expect(db.calls[1].steps).toContainEqual(["eq", "user_id", "u"]);
  });
  it("maps people defaults and orders by name", async () => {
    db.reply([person]);
    expect(await ops.getPeopleByUserId("u")).toMatchObject([
      { name: "Ana", mention_count: 0, details: {} },
    ]);
    expect(db.calls[0].steps).toContainEqual(["eq", "user_id", "u"]);
    expect(db.calls[0].steps).toContainEqual(["order", "name"]);
  });
  it.each([false, true])("saves a %s existing person", async (existing) => {
    db.reply(person);
    await ops.savePerson({
      name: "Ana",
      user_id: "u",
      ...(existing ? { id: "person" } : {}),
    });
    expect(db.calls[0].steps[0][0]).toBe(existing ? "update" : "insert");
    expect(db.calls[0].steps[0][1]).not.toHaveProperty("id");
  });
  it("deduplicates accents/case only within the same date and normalizes birthdays", async () => {
    db.reply({
      ...person,
      details: {
        gustos: {
          entries: [
            { value: "Café", date: row.date },
            { value: "Café", date: "2024-02-28" },
          ],
        },
      },
    });
    db.reply(person);
    await ops.saveExtractedPersonInfo(
      "Ana",
      {
        gustos: ["cafe", " Café "],
        cumpleanos: "1 enero",
        ignored: null,
        invalid: 5,
      },
      "u",
      row.date,
    );
    const payload = db.calls[1].steps[0][1];
    expect(payload.details.gustos.entries).toHaveLength(2);
    expect(payload.details["cumpleaños"].entries).toEqual([
      { value: "1 enero", date: row.date },
    ]);
    expect(payload.details).not.toHaveProperty("ignored");
  });
  it.each(["rol", "relacion", "cumpleaños", "direccion"])(
    "replaces unique %s only on that date",
    async (key) => {
      db.reply({
        ...person,
        details: {
          [key]: {
            entries: [
              { value: "Antes", date: row.date },
              { value: "Histórico", date: "2024-02-28" },
            ],
          },
        },
      });
      db.reply(person);
      await ops.saveExtractedPersonInfo(
        "Ana",
        { [key]: "nuevo" },
        "u",
        row.date,
      );
      expect(db.calls[1].steps[0][1].details[key].entries).toEqual([
        { value: "Nuevo", date: row.date },
        { value: "Histórico", date: "2024-02-28" },
      ]);
    },
  );
  it("creates an unknown person with owner and dated details", async () => {
    db.reply(null);
    db.reply(person);
    await ops.saveExtractedPersonInfo("Ana", { gustos: "leer" }, "u", row.date);
    expect(db.calls[1].steps[0]).toEqual([
      "insert",
      expect.objectContaining({
        name: "Ana",
        user_id: "u",
        details: { gustos: { entries: [{ value: "Leer", date: row.date }] } },
      }),
    ]);
  });
  it("does not insert when lookup failed", async () => {
    db.reply(null, { message: "offline" });
    expect(await ops.saveExtractedPersonInfo("Ana", {}, "u")).toBeNull();
    expect(db.calls).toHaveLength(1);
  });
  it("adds a manual detail to the person owner", async () => {
    db.reply(person);
    db.reply(person);
    db.reply(person);
    await ops.addPersonDetail("person", "gustos", "leer", row.date);
    expect(db.calls[1].steps).toContainEqual(["eq", "user_id", "u"]);
  });
  it("does not create a detail for a nonexistent person", async () => {
    expect(await ops.addPersonDetail("missing", "x", "y")).toBeNull();
    expect(db.calls).toHaveLength(1);
  });
  it("returns empty default details", () =>
    expect(
      ops.getPersonDetailsWithDates({ ...person, details: undefined }),
    ).toEqual({}));
  it("saves and reads audio tied to its entry", async () => {
    const audio = {
      id: "a",
      entry_id: "entry",
      audio_url: "data:audio/wav;base64,AA==",
      transcription: "Hola",
      created_at: row.created_at,
    };
    db.reply(audio);
    expect(
      await ops.saveAudioTranscription("entry", audio.audio_url, "Hola"),
    ).toEqual(audio);
    db.reply([audio]);
    expect(await ops.getTranscriptionsByEntryId("entry")).toEqual([audio]);
    expect(db.calls[1].steps).toContainEqual(["eq", "entry_id", "entry"]);
  });
  it("uses a deterministic mood ID for owner/date and conflict target", async () => {
    db.reply(row);
    await ops.saveMoodData({ user_id: "u", date: row.date });
    const first = db.calls[0].steps[0];
    expect(first).toEqual([
      "upsert",
      expect.objectContaining({
        stress_level: 0,
        happiness_level: 0,
        neutral_level: 0,
      }),
      { onConflict: "user_id,date" },
    ]);
    db.reply(row);
    await ops.saveMoodData({
      user_id: "u",
      date: row.date,
      happiness_level: 20,
    });
    expect(db.calls[1].steps[0][1].id).toBe(first[1].id);
    expect(ops.isValidUUID(first[1].id)).toBe(true);
  });
  it("rejects mood without date or owner before querying", async () => {
    expect(await ops.saveMoodData({ user_id: "u" })).toBeNull();
    expect(await ops.saveMoodData({ date: row.date })).toBeNull();
    expect(db.calls).toHaveLength(0);
  });
  it("scopes mood period reads and converts entry scores to numbers", async () => {
    db.reply([row]);
    await ops.getMoodDataByPeriod("u", "2024-01-01", "2024-12-31");
    expect(db.calls[0].steps).toContainEqual(["eq", "user_id", "u"]);
    db.reply([{ date: row.created_at, happiness: "25", stress: null }]);
    expect(
      await ops.getEntriesMoodDataByDateRange("u", row.date, row.date),
    ).toEqual([
      { date: row.date, happiness: 25, stress: 0, tranquility: 0, sadness: 0 },
    ]);
    expect(db.calls[1].steps).toContainEqual(["not", "happiness", "is", null]);
  });
  it("increments mentions of an existing owner-scoped person", async () => {
    db.reply({ ...person, mention_count: 4 });
    db.reply();
    await ops.incrementPersonMentionCount("u", "Ana");
    expect(db.calls[0].steps).toContainEqual(["eq", "user_id", "u"]);
    expect(db.calls[1].steps[0][1].mention_count).toBe(5);
  });
  it("does not update unknown mention counts", async () => {
    await ops.incrementPersonMentionCount("u", "missing");
    expect(db.calls).toHaveLength(1);
  });
  it.each([null, { message: "denied" }])(
    "reports mood update success/failure",
    async (error) => {
      db.reply(null, error);
      expect(
        await ops.updateEntryMoodData("entry", {
          happiness: 30,
          stress: 20,
          tranquility: 40,
          sadness: 10,
        }),
      ).toBe(!error);
    },
  );
  it.each([
    ["all entries", () => ops.getDiaryEntriesByUserId("u"), []],
    ["people", () => ops.getPeopleByUserId("u"), []],
    ["save person", () => ops.savePerson(person), null],
    ["save audio", () => ops.saveAudioTranscription("e", "url", "text"), null],
    ["read audio", () => ops.getTranscriptionsByEntryId("e"), []],
    [
      "save mood",
      () => ops.saveMoodData({ user_id: "u", date: row.date }),
      null,
    ],
    ["read mood", () => ops.getMoodDataByPeriod("u", row.date, row.date), []],
    [
      "entry mood",
      () => ops.getEntriesMoodDataByDateRange("u", row.date, row.date),
      [],
    ],
  ])("%s returns safe failure", async (_, run, fallback) => {
    db.reply(null, { message: "denied" });
    expect(await (run as Function)()).toEqual(fallback);
  });
});
describe("authentication operations", () => {
  it("registers profile metadata and signs out pending verification", async () => {
    expect(
      await ops.signUpUser("u@test.invalid", "password", "Ana"),
    ).toBeNull();
    expect(auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ data: { display_name: "Ana" } }),
      }),
    );
    expect(auth.signOut).toHaveBeenCalled();
  });
  it("maps verified user and retrieves a fresh token", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user }, error: null });
    const result = await ops.signInUser("u@test.invalid", "password");
    expect(result).toMatchObject({
      uid: "u",
      displayName: "Ana",
      emailVerified: true,
    });
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: "token" } },
    });
    expect(await result?.getIdToken()).toBe("token");
    auth.getSession.mockResolvedValue({ data: { session: null } });
    await expect(result?.getIdToken()).rejects.toThrow("sesión");
  });
  it("maps linked Google identities and alternate metadata", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {
        user: {
          ...user,
          app_metadata: { provider: "email", providers: ["email", "google"] },
          user_metadata: { full_name: "Nombre", picture: "url" },
        },
      },
      error: null,
    });
    expect(await ops.signInUser("u@test.invalid", "password")).toMatchObject({
      providerData: [{ providerId: "google.com" }],
      displayName: "Nombre",
      photoURL: "url",
    });
  });
  it("signs out an unverified email account", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { ...user, email_confirmed_at: null } },
      error: null,
    });
    await expect(ops.signInUser("u@test.invalid", "password")).rejects.toThrow(
      "verificar",
    );
    expect(auth.signOut).toHaveBeenCalled();
  });
  it("starts Google OAuth with the app origin", async () => {
    expect(await ops.signInWithGoogle()).toBeNull();
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: window.location.origin + "/" },
    });
  });
  it("requests recovery and verification with correct redirect paths", async () => {
    await ops.resetUserPassword("u@test.invalid");
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("u@test.invalid", {
      redirectTo: window.location.origin + "/reset-password",
    });
    await ops.resendEmailVerification("u@test.invalid");
    expect(auth.resend).toHaveBeenCalledWith(
      expect.objectContaining({ type: "signup", email: "u@test.invalid" }),
    );
  });
  it("requires an unverified authenticated user to resend verification", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    await expect(ops.sendEmailVerificationToCurrentUser()).rejects.toThrow(
      "autenticado",
    );
    auth.getUser.mockResolvedValue({ data: { user } });
    await expect(ops.sendEmailVerificationToCurrentUser()).rejects.toThrow(
      "ya está",
    );
    auth.getUser.mockResolvedValue({
      data: { user: { ...user, email_confirmed_at: null } },
    });
    await ops.sendEmailVerificationToCurrentUser();
    expect(auth.resend).toHaveBeenCalled();
  });
  it("updates name and enforces minimum password length", async () => {
    await ops.updateUserProfile({ displayName: "Nuevo" });
    expect(auth.updateUser).toHaveBeenCalledWith({
      data: { display_name: "Nuevo" },
    });
    await expect(ops.updateUserPassword("12345")).rejects.toThrow("6");
    await ops.updateUserPassword("123456");
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "123456" });
  });
  it("deletes through the existing account API and signs out only on success", async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: "t" } },
    });
    vi.mocked(fetch).mockResolvedValue(new Response("{}"));
    await ops.deleteUserAccount();
    expect(fetch).toHaveBeenCalledWith(
      "/api/account",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer t" },
      }),
    );
    expect(auth.signOut).toHaveBeenCalled();
  });
  it("keeps the session if account deletion fails", async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: "t" } },
    });
    vi.mocked(fetch).mockResolvedValue(
      new Response('{"error":"fallo"}', { status: 500 }),
    );
    await expect(ops.deleteUserAccountWithPassword()).rejects.toThrow("fallo");
    expect(auth.signOut).not.toHaveBeenCalled();
  });
  it("rejects deletion without a token", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    await expect(ops.deleteUserAccount()).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("provides identity fallbacks", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: { email: "ana@test.invalid", user_metadata: {} } },
    });
    expect(await ops.getUserInfo()).toEqual({
      name: "ana",
      email: "ana@test.invalid",
    });
    auth.getUser.mockResolvedValue({ data: { user: null } });
    expect(await ops.getUserInfo()).toEqual({ name: "Usuario", email: null });
  });
  it.each([
    ["signup", () => ops.signUpUser("e", "p", "n"), "signUp"],
    ["login", () => ops.signInUser("e", "p"), "signInWithPassword"],
    ["google", () => ops.signInWithGoogle(), "signInWithOAuth"],
    ["logout", () => ops.signOutUser(), "signOut"],
    ["resend", () => ops.resendEmailVerification("e"), "resend"],
    ["profile", () => ops.updateUserProfile({}), "updateUser"],
    ["password", () => ops.updateUserPassword("123456"), "updateUser"],
    ["reset", () => ops.resetUserPassword("e"), "resetPasswordForEmail"],
  ])("%s propagates service errors", async (_, run, key) => {
    auth[key as string].mockResolvedValue({
      data: {},
      error: new Error("service failed"),
    });
    await expect((run as Function)()).rejects.toThrow("service failed");
  });
});
