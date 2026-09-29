import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase-operations", () => ({
  getEntryByDate: vi.fn(),
  saveEntry: vi.fn(),
  getTranscriptionsByEntryId: vi.fn(),
}));
import {
  getEntryByDate,
  saveEntry,
  getTranscriptionsByEntryId,
} from "@/lib/supabase-operations";
import { useDiaryStore as store } from "@/lib/store";
const entry = {
  id: "e",
  date: "2026-09-29",
  content: "Original",
  user_id: "u",
  created_at: "",
  updated_at: "",
};
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};
beforeEach(() => {
  vi.mocked(getEntryByDate).mockReset().mockResolvedValue(null);
  vi.mocked(saveEntry).mockReset().mockResolvedValue(entry);
  vi.mocked(getTranscriptionsByEntryId).mockReset().mockResolvedValue([]);
  store.setState({
    currentDate: entry.date,
    currentEntry: null,
    isEditing: false,
    isLoading: false,
    error: null,
    transcriptions: [],
    dateManuallySelected: false,
  });
});
it("loads entry and audio and switches to reading mode", async () => {
  vi.mocked(getEntryByDate).mockResolvedValue(entry);
  vi.mocked(getTranscriptionsByEntryId).mockResolvedValue([{ id: "a" } as any]);
  await store.getState().fetchCurrentEntry("u");
  expect(store.getState()).toMatchObject({
    currentEntry: entry,
    isEditing: false,
    isLoading: false,
    transcriptions: [{ id: "a" }],
  });
});
it("opens editing for an empty day and clears previous audio", async () => {
  store.setState({ transcriptions: [{ id: "old" } as any] });
  await store.getState().fetchCurrentEntry("u");
  expect(store.getState()).toMatchObject({
    currentEntry: null,
    isEditing: true,
    transcriptions: [],
  });
});
it("reports load errors and always stops loading", async () => {
  vi.mocked(getEntryByDate).mockRejectedValue(new Error("offline"));
  await store.getState().fetchCurrentEntry("u");
  expect(store.getState()).toMatchObject({
    isLoading: false,
    error: "No se pudo cargar la entrada del diario",
  });
});
it("preserves entry when audio fails to load", async () => {
  vi.mocked(getEntryByDate).mockResolvedValue(entry);
  vi.mocked(getTranscriptionsByEntryId).mockRejectedValue(new Error("offline"));
  await store.getState().fetchCurrentEntry("u");
  expect(store.getState()).toMatchObject({
    currentEntry: entry,
    transcriptions: [],
  });
});
it("saves a new date and mentioned people", async () => {
  await store.getState().saveCurrentEntry("Nueva", "u", ["Ana"]);
  expect(saveEntry).toHaveBeenCalledWith({
    date: entry.date,
    content: "Nueva",
    user_id: "u",
    mentioned_people: ["Ana"],
  });
  expect(store.getState().isEditing).toBe(false);
});
it("updates the existing entry for the same owner/day", async () => {
  store.setState({ currentEntry: entry });
  await store.getState().saveCurrentEntry("Cambio", "u");
  expect(saveEntry).toHaveBeenCalledWith(expect.objectContaining({ id: "e" }));
});
it.each([null, new Error("offline")])(
  "keeps the original on failed save",
  async (failure) => {
    store.setState({ currentEntry: entry, isEditing: true });
    if (failure) vi.mocked(saveEntry).mockRejectedValue(failure);
    else vi.mocked(saveEntry).mockResolvedValue(null);
    await store.getState().saveCurrentEntry("Cambio", "u");
    expect(store.getState()).toMatchObject({
      currentEntry: entry,
      isEditing: true,
      isLoading: false,
      error: "No se pudo guardar la entrada del diario",
    });
  },
);
it("changing day clears data that belongs to the previous day", () => {
  store.setState({ currentEntry: entry, transcriptions: [{ id: "a" } as any] });
  store.getState().setCurrentDate("2026-09-30", true);
  expect(store.getState()).toMatchObject({
    currentDate: "2026-09-30",
    dateManuallySelected: true,
    currentEntry: null,
    transcriptions: [],
  });
});
it("an old slow entry response cannot overwrite the selected day", async () => {
  const slow = deferred<any>();
  vi.mocked(getEntryByDate).mockReturnValueOnce(slow.promise);
  const pending = store.getState().fetchCurrentEntry("u");
  store.getState().setCurrentDate("2026-09-30");
  await store.getState().fetchCurrentEntry("u");
  slow.resolve(entry);
  await pending;
  expect(store.getState()).toMatchObject({
    currentDate: "2026-09-30",
    currentEntry: null,
    isEditing: true,
    isLoading: false,
  });
});
it("an old slow audio response cannot overwrite the selected day", async () => {
  const slow = deferred<any>();
  vi.mocked(getEntryByDate).mockResolvedValueOnce(entry);
  vi.mocked(getTranscriptionsByEntryId).mockReturnValueOnce(slow.promise);
  const pending = store.getState().fetchCurrentEntry("u");
  await Promise.resolve();
  store.getState().setCurrentDate("2026-09-30");
  await store.getState().fetchCurrentEntry("u");
  slow.resolve([{ id: "old" }]);
  await pending;
  expect(store.getState().transcriptions).toEqual([]);
});
it.each([
  { ...entry, date: "2026-09-28" },
  { ...entry, user_id: "other" },
])("does not overwrite an entry from another date/owner", async (previous) => {
  store.setState({ currentEntry: previous });
  await store.getState().saveCurrentEntry("Nueva", "u");
  expect(vi.mocked(saveEntry).mock.calls[0][0]).not.toHaveProperty("id");
});
it("saving a day while navigating does not replace the next day", async () => {
  const slow = deferred<any>();
  vi.mocked(saveEntry).mockReturnValueOnce(slow.promise);
  const pending = store.getState().saveCurrentEntry("Hoy", "u");
  store.getState().setCurrentDate("2026-09-30");
  slow.resolve(entry);
  await pending;
  expect(store.getState().currentEntry).toBeNull();
});
it("toggles editing and clears error", () => {
  store.setState({ error: "error" });
  store.getState().resetError();
  store.getState().toggleEditMode();
  expect(store.getState()).toMatchObject({ error: null, isEditing: true });
  store.getState().toggleEditMode();
  expect(store.getState().isEditing).toBe(false);
});
it("refreshes transcription only when an entry is selected", async () => {
  await store.getState().fetchTranscriptions();
  expect(getTranscriptionsByEntryId).not.toHaveBeenCalled();
  store.setState({ currentEntry: entry });
  vi.mocked(getTranscriptionsByEntryId).mockRejectedValue(new Error("offline"));
  await store.getState().fetchTranscriptions();
  expect(store.getState().error).toContain("transcripciones");
});
