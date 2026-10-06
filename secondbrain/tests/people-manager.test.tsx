// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import PeopleManager from "@/components/PeopleManager";
import { normalizePersonDetails } from "@/lib/person-information";
const mock = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/supabase-operations", () => ({
  getPeopleByUserId: mock.read,
  savePerson: mock.save,
  getPersonDetailsWithDates: (person: any) =>
    normalizePersonDetails(person.details),
}));
vi.mock("@/components/PersonChat", () => ({ default: () => null }));
const person = {
  id: "p",
  name: "Ana",
  user_id: "u",
  updated_at: "2026-10-01T00:00:00.000001Z",
  details: {
    relacion: {
      entries: [
        { value: "amiga", date: "2025-01-01" },
        { value: "Amiga", date: "2025-02-01" },
      ],
    },
    detalles: {
      entries: [
        { value: "Café", date: "2025-01-01" },
        { value: "Café", date: "2025-02-01" },
        { value: "Nota sin fecha", date: "" },
      ],
    },
  },
};
beforeEach(() => {
  mock.read.mockReset().mockResolvedValue([person]);
  mock.save
    .mockReset()
    .mockImplementation(async (value) => ({ ...person, ...value }));
});
async function edit() {
  render(<PeopleManager userId="u" initialSelectedName="p" />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Editar" }));
  return user;
}
it("renders repeated relationships once while keeping separate dated events", async () => {
  render(<PeopleManager userId="u" initialSelectedName="p" />);
  await screen.findByRole("button", { name: "Editar" });
  expect(screen.getAllByText("amiga")).toHaveLength(2); // Summary plus one historical value.
  expect(screen.getAllByText("Café")).toHaveLength(2);
});
it("keeps all original event dates including undated notes when editing", async () => {
  const user = await edit();
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  await waitFor(() => expect(mock.save).toHaveBeenCalledOnce());
  expect(mock.save.mock.calls[0][0]).toMatchObject({
    user_id: "u",
    updated_at: person.updated_at,
    details: {
      detalles: {
        entries: [
          { value: "Café", date: "2025-02-01" },
          { value: "Café", date: "2025-01-01" },
          { value: "Nota sin fecha", date: "" },
        ],
      },
    },
  });
});
it("records a manual relationship change without erasing its previous history", async () => {
  const user = await edit();
  const input = screen.getByRole("textbox", {
    name: "Información sobre relacion",
  });
  await user.clear(input);
  await user.type(input, "pareja");
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  expect(mock.save.mock.calls[0][0].details.relacion.entries).toEqual([
    { value: "amiga", date: "2025-01-01" },
    { value: "pareja", date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
  ]);
});
it("can clear one memory without restoring it or deleting the other memories", async () => {
  const user = await edit();
  await user.clear(screen.getByRole("textbox", { name: "Recuerdo 1" }));
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  expect(mock.save.mock.calls[0][0].details.detalles.entries).toEqual([
    { value: "Café", date: "2025-01-01" },
    { value: "Nota sin fecha", date: "" },
  ]);
});
it("keeps the editable draft and reports a concurrent save conflict", async () => {
  mock.save.mockResolvedValue(null);
  const user = await edit();
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  expect(
    await screen.findByText(/La persona puede haber cambiado/),
  ).toBeVisible();
  expect(
    screen.getByRole("textbox", { name: "Información sobre relacion" }),
  ).toBeVisible();
});
it("ignores a delayed address book response from another account", async () => {
  let resolve!: (value: any) => void;
  mock.read
    .mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    )
    .mockResolvedValueOnce([]);
  const { rerender } = render(<PeopleManager userId="u" />);
  rerender(<PeopleManager userId="other" />);
  await screen.findByText("No hay personas registradas aún.");
  await act(async () => resolve([person]));
  expect(screen.queryByText("Ana")).toBeNull();
});
it("does not close another person editing session when a delayed save completes", async () => {
  mock.read.mockResolvedValue([person, { ...person, id: "b", name: "Bea" }]);
  let resolve!: (value: any) => void;
  mock.save.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const user = await edit();
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  await user.click(screen.getByText("Bea", { exact: true }));
  await user.click(screen.getByRole("button", { name: "Editar" }));
  await act(async () => resolve(person));
  expect(
    screen.getByRole("textbox", { name: "Nombre de la persona" }),
  ).toHaveValue("Bea");
  expect(
    screen.getByRole("textbox", { name: "Información sobre relacion" }),
  ).toBeVisible();
});

it("opens the canonical profile when initial selection differs in case and spacing", async () => {
  mock.read.mockResolvedValue([{ ...person, name: "Mamá" }]);
  render(<PeopleManager userId="u" initialSelectedName=" mamá " />);
  expect(
    await screen.findByRole("button", { name: "Chat con Mamá" }),
  ).toBeVisible();
});

it("edits a memory without changing its original date", async () => {
  const user = await edit();
  const memory = screen.getByRole("textbox", { name: "Recuerdo 1" });
  await user.clear(memory);
  await user.type(memory, "Me invitó a un café");
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  expect(mock.save.mock.calls[0][0].details.detalles.entries[0]).toEqual({
    value: "Me invitó a un café",
    date: "2025-02-01",
  });
});
it("adds fixed profile information without a free category prompt or overwriting old fields", async () => {
  const user = await edit();
  expect(screen.queryByText("Añadir categoría")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Añadir información" }));
  const selector = screen.getByRole("combobox", { name: "Qué quieres añadir" });
  expect(screen.getAllByRole("option")).toHaveLength(5);
  await user.selectOptions(selector, "rol");
  await user.click(screen.getByRole("button", { name: "Añadir", exact: true }));
  await user.type(
    screen.getByRole("textbox", { name: "Información sobre rol" }),
    "Profesora",
  );
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  expect(mock.save.mock.calls[0][0].details.rol.entries[0].value).toBe(
    "Profesora",
  );
  expect(mock.save.mock.calls[0][0].details.relacion.entries[0].value).toBe(
    "amiga",
  );
});
it("deletes only the chosen memory and adds another with its own date", async () => {
  const user = await edit();
  await user.click(screen.getByRole("button", { name: "Eliminar recuerdo 1" }));
  await user.click(screen.getByRole("button", { name: "Añadir recuerdo" }));
  await user.type(
    screen.getByRole("textbox", { name: "Recuerdo 3" }),
    "Fuimos al teatro",
  );
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  const entries = mock.save.mock.calls[0][0].details.detalles.entries;
  expect(entries).toHaveLength(3);
  expect(entries[0]).toEqual({ value: "Café", date: "2025-01-01" });
  expect(entries[2]).toMatchObject({
    value: "Fuimos al teatro",
    date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  });
});

it("preserves existing custom categories and their dates when saving", async () => {
  mock.read.mockResolvedValue([
    {
      ...person,
      details: {
        ...person.details,
        gustos: { entries: [{ value: "Jazz", date: "2024-02-01" }] },
      },
    },
  ]);
  const user = await edit();
  expect(screen.getByRole("textbox", { name: "gustos 1" })).toHaveValue("Jazz");
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  expect(mock.save.mock.calls[0][0].details.gustos.entries).toEqual([
    { value: "Jazz", date: "2024-02-01" },
  ]);
});
