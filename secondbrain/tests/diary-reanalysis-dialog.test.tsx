// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const mock = vi.hoisted(() => ({
  fetch: vi.fn(),
  denied: vi.fn(),
  updated: vi.fn(),
}));
vi.mock("@/lib/authenticated-fetch", () => ({
  authenticatedFetch: mock.fetch,
}));
import DiaryReanalysisDialog from "@/components/dashboard/DiaryReanalysisDialog";
const user = {
  uid: "22222222-2222-4222-8222-222222222222",
  email: "ana@test.invalid",
  display_name: "Ana",
} as any;
const job = {
  id: "33333333-3333-4333-8333-333333333333",
  userId: user.uid,
  status: "running",
  total: 2,
  done: 0,
  pending: 2,
  failed: 0,
  skipped: 0,
  peoplePending: 1,
  issues: [],
  inFlight: false,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const view = () =>
  render(
    <DiaryReanalysisDialog
      user={user}
      onDenied={mock.denied}
      onUpdated={mock.updated}
      onClose={() => {}}
    />,
  );
beforeEach(() => {
  mock.fetch.mockReset();
  mock.denied.mockReset();
  mock.updated.mockReset();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
it("opening only reads counts, never starts AI without the button", async () => {
  mock.fetch.mockResolvedValue(
    json({ eligible: 2, peoplePending: 1, job: null }),
  );
  view();
  await screen.findByText("entradas con texto", { exact: false });
  expect(mock.fetch).toHaveBeenCalledTimes(1);
  expect(mock.fetch.mock.calls[0][1].method).toBeUndefined();
  expect(screen.getByText(/Tiene coste de IA/)).toBeVisible();
});
it("lost start response retries the same request UUID rather than repeating a completed batch", async () => {
  mock.fetch
    .mockResolvedValueOnce(json({ eligible: 2, peoplePending: 1, job: null }))
    .mockRejectedValueOnce(new Error("Red interrumpida"))
    .mockResolvedValueOnce(
      json({ job: { ...job, status: "completed", done: 2, pending: 0 } }),
    );
  view();
  const button = await screen.findByRole("button", {
    name: "Analizar todas las entradas",
  });
  await userEvent.setup().click(button);
  await screen.findByRole("alert");
  await userEvent.setup().click(button);
  await screen.findByText("Proceso finalizado");
  const posts = mock.fetch.mock.calls.filter(
    (call) => call[1].method === "POST",
  );
  expect(posts).toHaveLength(2);
  expect(JSON.parse(posts[0][1].body).requestId).toBe(
    JSON.parse(posts[1][1].body).requestId,
  );
});
it("closing during a provider request preserves server progress and never launches another entry", async () => {
  let finish!: (r: Response) => void;
  mock.fetch
    .mockResolvedValueOnce(json({ eligible: 2, peoplePending: 1, job }))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  const rendered = view();
  await userEvent
    .setup()
    .click(await screen.findByRole("button", { name: "Reanudar" }));
  await waitFor(() => expect(mock.fetch).toHaveBeenCalledTimes(2));
  rendered.unmount();
  await act(async () => finish(json({ job: { ...job, done: 1, pending: 1 } })));
  expect(mock.fetch).toHaveBeenCalledTimes(2);
  expect(mock.updated).not.toHaveBeenCalled();
});
it("revoked administrator stops the next entry and returns control to the access gate", async () => {
  mock.fetch
    .mockResolvedValueOnce(json({ eligible: 2, peoplePending: 1, job }))
    .mockResolvedValueOnce(json({ error: "Permiso revocado" }, 403));
  view();
  await userEvent
    .setup()
    .click(await screen.findByRole("button", { name: "Reanudar" }));
  await screen.findByRole("alert");
  expect(mock.denied).toHaveBeenCalledOnce();
  expect(mock.fetch).toHaveBeenCalledTimes(2);
});
