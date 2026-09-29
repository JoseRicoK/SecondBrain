// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { useDiaryStore as store } from "@/lib/store";
import DiaryEditor from "@/components/DiaryEditor";
import TranscriptionsList from "@/components/TranscriptionsList";
vi.mock("@/lib/supabase-operations", () => ({
  getEntryByDate: vi.fn(),
  saveEntry: vi.fn(),
  getTranscriptionsByEntryId: vi.fn(),
}));
const entry = {
  id: "e",
  date: "2026-09-29",
  content: "Mi entrada",
  user_id: "u",
  created_at: "",
  updated_at: "",
};
beforeEach(() => {
  store.setState({
    currentEntry: entry,
    isLoading: false,
    isEditing: false,
    transcriptions: [],
    error: null,
  });
});
it("reads existing entry and opens editing", async () => {
  render(<DiaryEditor userId="u" />);
  expect(screen.getByText("Mi entrada")).toBeVisible();
  await userEvent.setup().click(screen.getByRole("button", { name: "Editar" }));
  expect(screen.getByRole("textbox")).toHaveValue("Mi entrada");
});
it("save passes the edited text and owner", async () => {
  const save = vi.fn();
  const original = store.getState().saveCurrentEntry;
  store.setState({ isEditing: true, saveCurrentEntry: save });
  try {
    render(<DiaryEditor userId="u" />);
    const u = userEvent.setup();
    await u.clear(screen.getByRole("textbox"));
    await u.type(screen.getByRole("textbox"), "Texto nuevo");
    await u.click(screen.getByRole("button", { name: "Guardar" }));
    expect(save).toHaveBeenCalledWith("Texto nuevo", "u");
  } finally {
    store.setState({ saveCurrentEntry: original });
  }
});
it("sanitizes diary HTML and keeps readable formatting", () => {
  store.setState({
    currentEntry: {
      ...entry,
      content:
        '<script>bad()</script><img src=x onerror="bad()"><b>Seguro</b>\nSegunda línea',
    },
  });
  const { container } = render(<DiaryEditor userId="u" />);
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("img")).not.toHaveAttribute("onerror");
  expect(screen.getByText("Seguro")).toBeVisible();
  expect(container.querySelector("br")).not.toBeNull();
});
it("shows loading instead of stale diary content", () => {
  store.setState({ isLoading: true });
  render(<DiaryEditor userId="u" />);
  expect(screen.getByText("Cargando entrada...")).toBeVisible();
  expect(screen.queryByText("Mi entrada")).toBeNull();
});
it("renders empty audio guidance", () => {
  render(<TranscriptionsList />);
  expect(screen.getByText("Aún no hay transcripciones.")).toBeVisible();
});
it("renders transcripts as text and attaches audio controls", () => {
  store.setState({
    transcriptions: [
      {
        id: "a",
        entry_id: "e",
        audio_url: "data:audio/wav;base64,AA==",
        transcription: "<script>bad()</script>\nHola",
        created_at: "2026-09-29T12:00:00Z",
      },
    ],
  });
  const { container } = render(<TranscriptionsList />);
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("audio")).toHaveAttribute("controls");
  expect(screen.getByText(/bad/)).toBeVisible();
});
