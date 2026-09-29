// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import Admin from "@/app/admin/page";
const send = vi.hoisted(() => vi.fn());
vi.mock("@/lib/authenticated-fetch", () => ({ authenticatedFetch: send }));
beforeEach(() => {
  send.mockReset();
});
it("requires an ID before attempting any administrative operation", async () => {
  render(<Admin />);
  const u = userEvent.setup();
  await u.click(screen.getByRole("button", { name: /Asignar Plan Pro/ }));
  expect(screen.getByText(/Necesitas introducir un User ID$/)).toBeVisible();
  expect(send).not.toHaveBeenCalled();
  await u.click(screen.getByRole("button", { name: /Simular Cancelación$/ }));
  expect(
    screen.getByText(/Necesitas introducir un User ID para cancelar/),
  ).toBeVisible();
  expect(send).not.toHaveBeenCalled();
});
it("server rejection does not appear as a plan assignment success", async () => {
  send.mockResolvedValue(
    new Response('{"error":"User mismatch"}', { status: 403 }),
  );
  render(<Admin />);
  const u = userEvent.setup();
  await u.type(
    screen.getByPlaceholderText("Introduce el UID del usuario"),
    "other",
  );
  await u.click(screen.getByRole("button", { name: /Asignar Plan Pro/ }));
  expect(await screen.findByText(/Error: User mismatch/)).toBeVisible();
  expect(screen.queryByText(/actualizado.*exitosamente/)).toBeNull();
});
