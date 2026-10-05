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
    { getState: () => ({ error: mock.error }) },
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
beforeEach(() => {
  mock.date = "2026-09-29";
  mock.owner = "u";
  mock.error = null;
  mock.save.mockReset().mockResolvedValue(undefined);
  mock.fetch
    .mockReset()
    .mockResolvedValue(
      new Response(JSON.stringify({ peopleExtracted: [{ name: "Ana" }] })),
    );
  vi.stubGlobal("fetch", mock.fetch);
});
async function analyze() {
  const user = userEvent.setup();
  await user.click(await screen.findByTitle("Analizar con IA"));
  return user;
}
it("replaces obsolete diary mentions instead of accumulating names on each analysis", async () => {
  render(<Home />);
  await analyze();
  await waitFor(() =>
    expect(mock.save).toHaveBeenCalledWith("Vi a Ana.", "u", ["Ana"]),
  );
});
it("saves an empty mention list when the revised entry no longer contains people", async () => {
  mock.fetch.mockResolvedValue(
    new Response(JSON.stringify({ peopleExtracted: [] })),
  );
  render(<Home />);
  await analyze();
  await waitFor(() =>
    expect(mock.save).toHaveBeenCalledWith("Vi a Ana.", "u", []),
  );
});
it.each(["date", "owner"])(
  "does not apply a delayed people response after changing %s",
  async (change) => {
    let resolve!: (value: any) => void;
    mock.fetch.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { rerender } = render(<Home />);
    await analyze();
    if (change === "date") mock.date = "2026-09-30";
    else mock.owner = "other";
    rerender(<Home />);
    await act(async () =>
      resolve(
        new Response(JSON.stringify({ peopleExtracted: [{ name: "Ana" }] })),
      ),
    );
    expect(mock.save).not.toHaveBeenCalled();
  },
);
it("shows the safe API error and retains mentions on a failed extraction", async () => {
  mock.fetch.mockResolvedValue(
    new Response(JSON.stringify({ error: "Puedes reintentarlo." }), {
      status: 500,
    }),
  );
  render(<Home />);
  await analyze();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Puedes reintentarlo.",
  );
  expect(mock.save).not.toHaveBeenCalled();
});
it("surfaces failed diary persistence after extracting people", async () => {
  mock.save.mockImplementation(async () => {
    mock.error = "No se pudo guardar la entrada del diario";
  });
  render(<Home />);
  await analyze();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No se pudo guardar",
  );
});
it("shows a partial mood warning after persisting successful people extraction", async () => {
  mock.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        peopleExtracted: [{ name: "Ana" }],
        warning: "No se pudo actualizar el análisis emocional.",
      }),
    ),
  );
  render(<Home />);
  await analyze();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "análisis emocional",
  );
  expect(mock.save).toHaveBeenCalledOnce();
});
