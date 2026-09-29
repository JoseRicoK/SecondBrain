// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import Auth from "@/components/Auth";
import ResetPassword from "@/app/reset-password/page";
const mock = vi.hoisted(() => ({
  login: vi.fn(),
  signup: vi.fn(),
  google: vi.fn(),
  reset: vi.fn(),
  resend: vi.fn(),
  session: vi.fn(),
  update: vi.fn(),
  push: vi.fn(),
}));
vi.mock("@/lib/supabase-operations", () => ({
  signInUser: mock.login,
  signUpUser: mock.signup,
  signInWithGoogle: mock.google,
  resetUserPassword: mock.reset,
  resendEmailVerification: mock.resend,
}));
vi.mock("@/lib/supabase-test", () => ({ testSupabaseConnection: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: mock.session, updateUser: mock.update } },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mock.push }) }));
const credentials = async () => {
  const u = userEvent.setup();
  await u.type(screen.getByLabelText("Email"), "ana@test.invalid");
  await u.type(
    screen.getByLabelText("Contraseña", { exact: true }),
    "password",
  );
  return u;
};
beforeEach(() => {
  for (const fn of Object.values(mock)) fn.mockReset();
  mock.session.mockResolvedValue({ data: { session: {} } });
  mock.update.mockResolvedValue({ error: null });
  window.history.replaceState({}, "", "/");
});
it("logs in and passes the authenticated user to the parent", async () => {
  mock.login.mockResolvedValue({ uid: "u" });
  const success = vi.fn();
  render(<Auth onAuthSuccess={success} />);
  const u = await credentials();
  await u.click(
    screen.getByRole("button", { name: "Iniciar sesión", exact: true }),
  );
  await waitFor(() =>
    expect(success).toHaveBeenCalledWith({ uid: "u" }, undefined),
  );
  expect(mock.login).toHaveBeenCalledWith("ana@test.invalid", "password");
});
it("displays login errors without authenticating the UI", async () => {
  mock.login.mockRejectedValue(new Error("Credenciales incorrectas"));
  const success = vi.fn();
  render(<Auth onAuthSuccess={success} />);
  const u = await credentials();
  await u.click(
    screen.getByRole("button", { name: "Iniciar sesión", exact: true }),
  );
  expect(await screen.findByText("Credenciales incorrectas")).toBeVisible();
  expect(success).not.toHaveBeenCalled();
});
it("selected plan opens registration, and signup requires verification", async () => {
  window.history.replaceState({}, "", "/?plan=elite");
  render(<Auth onAuthSuccess={vi.fn()} />);
  expect(screen.getByText("Crea una cuenta nueva")).toBeVisible();
  const u = await credentials();
  await u.type(screen.getByLabelText("Nombre"), "Ana");
  await u.click(
    screen.getByRole("button", { name: "Registrarse", exact: true }),
  );
  expect(mock.signup).toHaveBeenCalledWith(
    "ana@test.invalid",
    "password",
    "Ana",
  );
  expect(await screen.findByText(/Registro exitoso/)).toBeVisible();
  expect(screen.getByLabelText("Contraseña", { exact: true })).toHaveValue("");
});
it("rejects recovery without email and requests it with email", async () => {
  render(<Auth onAuthSuccess={vi.fn()} />);
  const u = userEvent.setup();
  await u.click(screen.getByRole("button", { name: /Olvidé mi contraseña/ }));
  expect(screen.getByText(/Ingresa tu email para recuperar/)).toBeVisible();
  await u.type(screen.getByLabelText("Email"), "ana@test.invalid");
  await u.click(screen.getByRole("button", { name: /Olvidé mi contraseña/ }));
  expect(mock.reset).toHaveBeenCalledWith("ana@test.invalid");
  expect(await screen.findByText(/Hemos enviado/)).toBeVisible();
});
it("starts Google login and handles service errors", async () => {
  mock.google.mockRejectedValue(new Error("Google unavailable"));
  render(<Auth onAuthSuccess={vi.fn()} />);
  await userEvent.setup().click(screen.getByRole("button", { name: /Google/ }));
  expect(mock.google).toHaveBeenCalled();
  expect(await screen.findByText("Google unavailable")).toBeVisible();
});
it("reset page reports an invalid recovery session", async () => {
  mock.session.mockResolvedValue({ data: { session: null } });
  render(<ResetPassword />);
  expect(await screen.findByText(/inválido o expirado/)).toBeVisible();
});
it("reset rejects mismatched passwords without changing Auth", async () => {
  render(<ResetPassword />);
  const u = userEvent.setup();
  await u.type(screen.getByLabelText("Nueva contraseña"), "password1");
  await u.type(screen.getByLabelText("Confirmar contraseña"), "password2");
  await u.click(screen.getByRole("button", { name: "Actualizar contraseña" }));
  expect(screen.getByText("Las contraseñas no coinciden")).toBeVisible();
  expect(mock.update).not.toHaveBeenCalled();
});
it("reset accepts matching passwords and offers login navigation", async () => {
  render(<ResetPassword />);
  const u = userEvent.setup();
  await u.type(screen.getByLabelText("Nueva contraseña"), "password1");
  await u.type(screen.getByLabelText("Confirmar contraseña"), "password1");
  await u.click(screen.getByRole("button", { name: "Actualizar contraseña" }));
  expect(await screen.findByText("¡Contraseña actualizada!")).toBeVisible();
  expect(mock.update).toHaveBeenCalledWith({ password: "password1" });
  await u.click(screen.getByRole("button", { name: "Ir al inicio de sesión" }));
  expect(mock.push).toHaveBeenCalledWith("/");
});
it("reset shows provider errors", async () => {
  mock.update.mockResolvedValue({ error: new Error("expired") });
  render(<ResetPassword />);
  fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
    target: { value: "password1" },
  });
  fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
    target: { value: "password1" },
  });
  fireEvent.submit(
    screen
      .getByRole("button", { name: "Actualizar contraseña" })
      .closest("form")!,
  );
  expect(await screen.findByText("expired")).toBeVisible();
});
