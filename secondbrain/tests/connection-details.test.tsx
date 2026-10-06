// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const mock = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/authenticated-fetch", () => ({
  authenticatedFetch: mock.fetch,
}));
import ConnectionDetails from "@/components/statistics/ConnectionDetails";
const entries = Array.from({ length: 9 }, (_, index) => ({
  date: `2026-09-${String(20 - index).padStart(2, "0")}`,
  excerpt: `Recuerdo ${index + 1}`,
  happiness: 50,
  tranquility: 20,
  stress: 0,
  sadness: null,
  neutral: 30,
}));
const connection = {
  key: "pair",
  source: "Ana",
  target: "Luis",
  count: 9,
  dates: entries.map((entry) => entry.date),
};
beforeEach(() => {
  mock.fetch.mockReset();
  mock.fetch.mockResolvedValue(new Response(JSON.stringify({ entries })));
});
it.each([false, true])(
  "reveals four memories at a time without refetching (embedded=%s)",
  async (embedded) => {
    const open = vi.fn();
    const view = render(
      <ConnectionDetails
        connection={connection}
        period="all"
        onClose={vi.fn()}
        onOpenEntry={open}
        embedded={embedded}
      />,
    );
    await screen.findByText("Recuerdo 1");
    const memories = () =>
      screen.getAllByRole("button", { name: /^Abrir recuerdo/ });
    expect(memories()).toHaveLength(4);
    expect(screen.getByText("Mostrando 4 de 9 recuerdos")).toBeVisible();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Ver más recuerdos" }));
    expect(memories()).toHaveLength(8);
    await user.click(screen.getByRole("button", { name: "Ver más recuerdos" }));
    expect(memories()).toHaveLength(9);
    expect(
      screen.queryByRole("button", { name: "Ver más recuerdos" }),
    ).toBeNull();
    expect(mock.fetch).toHaveBeenCalledTimes(1);
    await user.click(memories()[8]);
    expect(open).toHaveBeenCalledWith(entries[8].date);
    await user.click(
      screen.getByRole("button", { name: "Mostrar menos recuerdos" }),
    );
    expect(memories()).toHaveLength(4);
    await user.click(screen.getByRole("button", { name: "Ver más recuerdos" }));
    mock.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ entries })));
    view.rerender(
      <ConnectionDetails
        connection={{ ...connection, source: "Eva" }}
        period="all"
        onClose={vi.fn()}
        onOpenEntry={open}
        embedded={embedded}
      />,
    );
    await screen.findAllByRole("button", { name: /^Abrir recuerdo con Eva/ });
    expect(memories()).toHaveLength(4);
  },
);
