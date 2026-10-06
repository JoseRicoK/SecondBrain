// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import Home from "@/app/page";
const mock = vi.hoisted(() => ({
  save: vi.fn(),
  load: vi.fn(),
  fetch: vi.fn(),
  date: "2026-09-29",
  owner: "u",
  error: null as string | null,
  entry: {
    id: "e",
    date: "2026-09-29",
    user_id: "u",
    content: "Vi a Ana.",
    mentioned_people: ["Ana", "Otra"],
  },
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { uid: mock.owner, getIdToken: async () => "test-token" },
    loading: false,
  }),
}));
vi.mock("@/lib/store", () => ({
  useDiaryStore: Object.assign(
    () => ({
      currentDate: mock.date,
      currentEntry: mock.entry,
      isLoading: false,
      error: mock.error,
      isEditing: false,
      saveCurrentEntry: mock.save,
      fetchCurrentEntry: mock.load,
      toggleEditMode: vi.fn(),
    }),
    { getState: () => ({ error: mock.error, currentEntry: mock.entry }) },
  ),
}));
vi.mock("@/components/Sidebar", () => ({ default: () => null }));
vi.mock("@/components/PersonalChat", () => ({ default: () => null }));
vi.mock("@/components/PersonalChatButton", () => ({ default: () => null }));
vi.mock("@/components/Auth", () => ({ default: () => null }));
vi.mock("@/components/Loading", () => ({ default: () => null }));
vi.mock("@/components/Settings", () => ({ default: () => null }));
vi.mock("@/components/StatisticsWrapper", () => ({ default: () => null }));
vi.mock("@/components/PeopleManager", () => ({ default: () => null }));
vi.mock("next/image", () => ({
  default: (props: any) => <img alt={props.alt} />,
}));
vi.mock("@/hooks/useDiaryAnalysis", () => ({
  useDiaryAnalysis: () => ({ analysis: null, restart: vi.fn() }),
}));
vi.mock("@/lib/authenticated-fetch", () => ({
  authenticatedFetch: (...args: unknown[]) => mock.fetch(...args),
}));
beforeEach(() => {
  mock.date = "2026-09-29";
  mock.owner = "u";
  mock.error = null;
  mock.save.mockReset().mockResolvedValue(undefined);
  mock.fetch
    .mockReset()
    .mockResolvedValue(
      new Response(JSON.stringify({ analysis: { status: "queued" } })),
    );
});
async function analyze() {
  await userEvent.setup().click(await screen.findByTitle("Analizar con IA"));
}
it("saves the draft before requesting the shared background analysis", async () => {
  render(<Home />);
  await analyze();
  await waitFor(() =>
    expect(mock.fetch).toHaveBeenCalledWith(
      "/api/diary-analysis",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ entryId: "e" }),
      }),
    ),
  );
  expect(mock.save).toHaveBeenCalledWith(
    "Vi a Ana.",
    "u",
    ["Ana", "Otra"],
    null,
  );
});
it("does not enqueue when the draft could not be saved", async () => {
  mock.save.mockImplementation(async () => {
    mock.error = "No se pudo guardar la entrada del diario";
  });
  render(<Home />);
  await analyze();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No se pudo guardar",
  );
  expect(mock.fetch).not.toHaveBeenCalled();
});
it("retains the saved draft when the queue request fails", async () => {
  mock.fetch.mockResolvedValue(
    new Response(JSON.stringify({ error: "Puedes reintentarlo." }), {
      status: 503,
    }),
  );
  render(<Home />);
  await analyze();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Puedes reintentarlo.",
  );
  expect(mock.save).toHaveBeenCalledOnce();
});
it.each(["date", "owner"])(
  "ignores a late failure after changing %s",
  async (change) => {
    let resolve!: (value: Response) => void;
    mock.fetch.mockReturnValue(new Promise((r) => (resolve = r)));
    const { rerender } = render(<Home />);
    await analyze();
    await waitFor(() => expect(mock.fetch).toHaveBeenCalledOnce());
    if (change === "date") mock.date = "2026-09-30";
    else mock.owner = "other";
    rerender(<Home />);
    await act(async () =>
      resolve(
        new Response(JSON.stringify({ error: "Old failure" }), { status: 503 }),
      ),
    );
    expect(screen.queryByText("Old failure")).not.toBeInTheDocument();
  },
);
