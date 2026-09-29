import {
  test,
  expect,
  signIn,
  uid,
  openSidebar,
  noHorizontalOverflow,
} from "./fixtures";

test("anonymous visitor sees login and private API rejects missing token", async ({
  page,
  backend,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
  await noHorizontalOverflow(page);
  for (const path of [
    "statistics/people",
    "statistics/mood",
    "subscription/status?userId=foreign",
  ])
    expect((await request.get(`/api/${path}`)).status()).toBe(401);
  expect(
    backend.calls.filter((call) => call.path.includes("/rest/")),
  ).toHaveLength(0);
});
test("email login opens diary and restores saved content after reload", async ({
  page,
  backend,
}) => {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("ana@test.invalid");
  await page.getByLabel("Contraseña", { exact: true }).fill("password1");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    page.getByText("Hoy paseé con Ana por el parque.", { exact: true }),
  ).toBeVisible();
  await page.getByTitle("Editar", { exact: true }).click();
  const editor = page.getByPlaceholder(
    "Escribe tu entrada del diario aquí... ✨",
  );
  await editor.fill("Entrada escrita en el navegador.");
  await page.getByTitle("Guardar", { exact: true }).click();
  await expect(
    page.getByText("Entrada escrita en el navegador.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Entrada escrita en el navegador.", { exact: true }),
  ).toBeVisible();
  expect(backend.tables.diary_entries[0].user_id).toBe(uid);
  await noHorizontalOverflow(page);
});
test("canceling diary editing restores original text", async ({
  page,
  backend,
}) => {
  await signIn(page);
  await page.goto("/");
  await page.getByTitle("Editar", { exact: true }).click();
  await page
    .getByPlaceholder("Escribe tu entrada del diario aquí... ✨")
    .fill("Descartar cambios");
  await page.getByTitle("Cancelar", { exact: true }).click();
  await expect(
    page.getByText("Hoy paseé con Ana por el parque.", { exact: true }),
  ).toBeVisible();
  expect(
    backend.calls.filter(
      (call) => call.method === "PATCH" && call.path.endsWith("diary_entries"),
    ),
  ).toHaveLength(0);
});
test("AI stylization saves improved text and sends the authenticated owner", async ({
  page,
  backend,
}) => {
  await signIn(page);
  await page.goto("/");
  await page.getByTitle("Editar", { exact: true }).click();
  await page.getByTitle("Estilizar con IA").click();
  await expect(
    page.getByText("Texto mejorado sin perder tu voz.", { exact: true }),
  ).toBeVisible();
  expect(
    backend.calls.find((call) => call.path === "/api/stylize")?.body.userId,
  ).toBe(uid);
});
test("AI failure preserves diary content", async ({ page, backend }) => {
  backend.aiError = true;
  await signIn(page);
  await page.goto("/");
  await page.getByTitle("Editar", { exact: true }).click();
  await page.getByTitle("Estilizar con IA").click();
  await expect(
    page.getByPlaceholder("Escribe tu entrada del diario aquí... ✨"),
  ).toHaveValue("Hoy paseé con Ana por el parque.");
  await expect(page.getByText(/Error al estilizar/)).toBeVisible();
});
test("people search, details and editing preserve historical dates", async ({
  page,
  backend,
}) => {
  await signIn(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Abrir panel de personas", exact: true })
    .first()
    .click();
  const search = page.getByPlaceholder("Buscar por nombre, relación, rol...");
  await search.fill("Ana");
  await expect(page.getByText("Luis", { exact: true })).not.toBeVisible();
  await page
    .getByRole("heading", { name: "Personas", exact: true })
    .locator("..")
    .locator("..")
    .getByText("Ana", { exact: true })
    .click();
  await expect(page.getByText("Amiga", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Editar", exact: true })
    .filter({ visible: true })
    .last()
    .click();
  await page.getByLabel("Nombre de la persona").fill("Ana Actualizada");
  await page
    .getByRole("button", { name: "Guardar", exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByText("Ana Actualizada", { exact: true }),
  ).toBeVisible();
  expect(backend.tables.people[0].details.rol.entries[0].date).toBe(
    "2026-01-01",
  );
});
test("personal chat sends and shows responses, minimizes and closes", async ({
  page,
  backend,
}) => {
  await signIn(page);
  await page.goto("/");
  await page
    .getByTitle(/Chat Personal/)
    .filter({ visible: true })
    .click();
  const input = page.getByPlaceholder(
    "Pregúntame sobre tu vida, patrones, crecimiento...",
  );
  await input.fill("¿Cómo va mi semana?");
  await input.press("Enter");
  await expect(
    page.getByText("Puedes reflexionar sobre tus relaciones.", { exact: true }),
  ).toBeVisible();
  expect(
    backend.calls.find((call) => call.path === "/api/personal-chat")?.body
      .userId,
  ).toBe(uid);
  if (await page.getByTitle("Minimizar chat").isVisible()) {
    await page.getByTitle("Minimizar chat").click();
    await expect(input).not.toBeVisible();
    await page.getByTitle("Expandir chat").click();
    await expect(input).toBeVisible();
  }
  await page.getByTitle("Cerrar chat").click();
  await expect(input).not.toBeVisible();
});
test("chat handles monthly quota rejection", async ({ page, backend }) => {
  backend.limit = true;
  await signIn(page);
  await page.goto("/");
  await page
    .getByTitle(/Chat Personal/)
    .filter({ visible: true })
    .click();
  const input = page.getByPlaceholder(
    "Pregúntame sobre tu vida, patrones, crecimiento...",
  );
  await input.fill("Hola");
  await input.press("Enter");
  await expect(
    page.getByText(/Has alcanzado el límite/i).first(),
  ).toBeVisible();
});
test("settings updates profile and sends feedback", async ({
  page,
  backend,
}) => {
  await signIn(page);
  await page.goto("/");
  await openSidebar(page);
  await page.getByRole("button", { name: /Configuración/ }).click();
  await page.getByPlaceholder("Tu nombre de usuario").fill("Ana Nueva");
  await page
    .getByRole("button", { name: "Guardar Cambios", exact: true })
    .click();
  await expect(
    page.getByText("Nombre actualizado correctamente"),
  ).toBeVisible();
  await page
    .getByPlaceholder("Comparte tus ideas para mejorar la aplicación...")
    .fill("Me gustaría exportar el diario");
  await page.getByRole("button", { name: "Enviar Sugerencia" }).click();
  await expect(
    page.getByText(/sugerencia ha sido enviado correctamente/),
  ).toBeVisible();
  expect(
    backend.calls.find((call) => call.path === "/api/send-feedback")?.body
      .message,
  ).toBe("Me gustaría exportar el diario");
});
test("statistics displays summary, quote and people data", async ({
  page,
  backend,
}) => {
  await signIn(page);
  await page.goto("/");
  await openSidebar(page);
  await page.getByRole("button", { name: /Estadísticas/ }).click();
  await expect(
    page.getByText("Has dedicado tiempo a tus amistades."),
  ).toBeVisible();
  await expect(page.getByText(/Cada día es una oportunidad/)).toBeVisible();
  await expect(page.getByText("Ana", { exact: true })).toBeVisible();
  await noHorizontalOverflow(page);
});
test("subscription preserves plans but cannot start real checkout", async ({
  page,
  backend,
}) => {
  await signIn(page);
  backend.tables.profiles[0].subscription.plan = "free";
  backend.tables.profiles[0].subscription.status = "inactive";
  await page.goto("/subscription");
  await expect(
    page.getByText(/pagos.*próximamente|pagos.*todavía/i).first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Suscribirse a/ })).toHaveCount(
    0,
  );
  expect(
    backend.calls.filter((call) =>
      call.path.includes("create-checkout-session"),
    ),
  ).toHaveLength(0);
});
test("reset password validates matching fields", async ({ page, backend }) => {
  await signIn(page);
  await page.goto("/reset-password");
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("password1");
  await page
    .getByLabel("Confirmar contraseña", { exact: true })
    .fill("password2");
  await page.getByRole("button", { name: "Actualizar contraseña" }).click();
  await expect(page.getByText("Las contraseñas no coinciden")).toBeVisible();
  await page
    .getByLabel("Confirmar contraseña", { exact: true })
    .fill("password1");
  await page.getByRole("button", { name: "Actualizar contraseña" }).click();
  await expect(page.getByText("¡Contraseña actualizada!")).toBeVisible();
  expect(
    backend.calls.some(
      (call) =>
        call.path === "/auth/v1/user" &&
        call.method === "PUT" &&
        call.body.password === "password1",
    ),
  ).toBe(true);
});

test("failed save keeps the draft and shows the failure", async ({
  page,
  backend,
}) => {
  backend.failSave = true;
  await signIn(page);
  await page.goto("/");
  await page.getByTitle("Editar", { exact: true }).click();
  await page
    .getByPlaceholder("Escribe tu entrada del diario aquí... ✨")
    .fill("Mi borrador sin guardar");
  await page.getByTitle("Guardar", { exact: true }).click();
  await expect(
    page.getByText("No se pudo guardar la entrada del diario"),
  ).toBeVisible();
  await expect(
    page.getByPlaceholder("Escribe tu entrada del diario aquí... ✨"),
  ).toHaveValue("Mi borrador sin guardar");
  expect(backend.tables.diary_entries[0].content).toBe(
    "Hoy paseé con Ana por el parque.",
  );
});
test("calendar selection creates a separate entry without changing today", async ({
  page,
  backend,
}) => {
  await signIn(page);
  await page.goto("/");
  await openSidebar(page);
  const previous = new Date();
  previous.setDate(previous.getDate() - 1);
  const label = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(previous);
  await page.getByRole("button", { name: label, exact: true }).click();
  const editor = page.getByPlaceholder(
    "Escribe tu entrada del diario aquí... ✨",
  );
  await expect(editor).toHaveValue("");
  await editor.fill("Recuerdo de ayer");
  await page.getByTitle("Guardar", { exact: true }).click();
  await expect(
    page.getByText("Recuerdo de ayer", { exact: true }),
  ).toBeVisible();
  expect(backend.tables.diary_entries).toHaveLength(2);
  expect(backend.tables.diary_entries[0].content).toBe(
    "Hoy paseé con Ana por el parque.",
  );
});
test("person extraction uses the entry date and ID", async ({
  page,
  backend,
}) => {
  await signIn(page);
  await page.goto("/");
  await page.getByTitle("Analizar con IA").click();
  await expect
    .poll(() =>
      backend.calls.some((call) => call.path === "/api/extract-people"),
    )
    .toBe(true);
  const call = backend.calls.find(
    (call) => call.path === "/api/extract-people",
  )!;
  expect(call.body).toMatchObject({
    userId: uid,
    entryId: "entry-fixture",
    entryDate: backend.tables.diary_entries[0].date,
  });
});
test("person chat uses the selected person context", async ({
  page,
  backend,
}) => {
  await signIn(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Abrir panel de personas", exact: true })
    .first()
    .click();
  await expect(
    page.getByPlaceholder("Buscar por nombre, relación, rol..."),
  ).toBeVisible();
  await page
    .getByRole("heading", { name: "Personas", exact: true })
    .locator("..")
    .locator("..")
    .getByText("Ana", { exact: true })
    .click();
  await page.getByTitle("Chat con Ana").click();
  const input = page.getByPlaceholder("Pregunta algo sobre Ana...");
  await input.fill("¿Qué le gusta?");
  await input.press("Enter");
  await expect(
    page.getByText("Puedes reflexionar sobre tus relaciones.", { exact: true }),
  ).toBeVisible();
  expect(
    backend.calls.find((call) => call.path === "/api/chat-person")?.body.person
      .name,
  ).toBe("Ana");
  await page.getByRole("button", { name: "Cerrar chat" }).click();
  await expect(input).not.toBeVisible();
});
test("microphone permission refusal is visible and does not alter the entry", async ({
  page,
  backend,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => {
          throw new DOMException("denied", "NotAllowedError");
        },
      },
    });
  });
  await signIn(page);
  await page.goto("/");
  await page.getByTitle("Iniciar grabación").click();
  await expect(page.getByText("Error al acceder al micrófono")).toBeVisible();
  expect(backend.calls.some((call) => call.path === "/api/transcribe")).toBe(
    false,
  );
});
test("recording transcribes and appends text to the saved diary", async ({
  page,
  backend,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => ({ getTracks: () => [{ stop: () => {} }] }),
      },
    });
    class Recorder {
      ondataavailable: any;
      onstop: any;
      state = "inactive";
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({
          data: new Blob([new Uint8Array(2000)], { type: "audio/wav" }),
        });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", { value: Recorder });
  });
  await signIn(page);
  await page.goto("/");
  await page.getByTitle("Iniciar grabación").click();
  await expect(page.getByTitle("Detener grabación")).toBeVisible();
  await page.getByTitle("Detener grabación").click();
  await expect(page.getByText(/Una reflexión grabada/)).toBeVisible();
  expect(backend.tables.diary_entries[0].content).toContain(
    "Hoy paseé con Ana",
  );
  expect(backend.tables.diary_entries[0].content).toContain(
    "Una reflexión grabada.",
  );
});
test("account deletion requires explicit confirmation and signs out", async ({
  page,
  backend,
}) => {
  await signIn(page);
  await page.goto("/");
  await openSidebar(page);
  await page.getByRole("button", { name: /Configuración/ }).click();
  await page
    .getByRole("button", { name: "Eliminar mi cuenta", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirmar Eliminación" }),
  ).toBeDisabled();
  await page.getByPlaceholder("Escribe ELIMINAR").fill("ELIMINAR");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Confirmar Eliminación" }).click();
  await expect(
    page.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
  expect(backend.calls.some((call) => call.path === "/api/account")).toBe(true);
});
test("feedback provider failure shows an error instead of success", async ({
  page,
  backend,
}) => {
  backend.emailError = true;
  await signIn(page);
  await page.goto("/");
  await openSidebar(page);
  await page.getByRole("button", { name: /Configuración/ }).click();
  await page
    .getByPlaceholder("Comparte tus ideas para mejorar la aplicación...")
    .fill("Mi sugerencia");
  await page.getByRole("button", { name: "Enviar Sugerencia" }).click();
  await expect(page.getByText("Error al enviar el mensaje")).toBeVisible();
});
test("settings validates passwords and updates matching fields", async ({
  page,
  backend,
}) => {
  await signIn(page);
  await page.goto("/");
  await openSidebar(page);
  await page.getByRole("button", { name: /Configuración/ }).click();
  await page
    .getByPlaceholder("Nueva contraseña", { exact: true })
    .fill("password1");
  await page.getByPlaceholder("Confirmar nueva contraseña").fill("password2");
  await page
    .getByRole("button", { name: "Guardar Cambios", exact: true })
    .click();
  await expect(page.getByText("Las contraseñas no coinciden")).toBeVisible();
  await page.getByPlaceholder("Confirmar nueva contraseña").fill("password1");
  await page
    .getByRole("button", { name: "Guardar Cambios", exact: true })
    .click();
  await expect(
    page.getByText("Contraseña actualizada correctamente"),
  ).toBeVisible();
  expect(
    backend.calls.some(
      (call) =>
        call.path === "/auth/v1/user" && call.body.password === "password1",
    ),
  ).toBe(true);
});

test("subscription cancellation requires confirmation and uses the current owner", async ({
  page,
  backend,
}) => {
  await signIn(page);
  await page.goto("/");
  await openSidebar(page);
  await page.getByRole("button", { name: /Configuración/ }).click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByText("¿Cancelar suscripción?")).toBeVisible();
  expect(
    backend.calls.some(
      (call) => call.path === "/api/stripe/cancel-subscription",
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "Sí, cancelar", exact: true }).click();
  await expect
    .poll(() =>
      backend.calls.some(
        (call) => call.path === "/api/stripe/cancel-subscription",
      ),
    )
    .toBe(true);
  expect(
    backend.calls.find(
      (call) => call.path === "/api/stripe/cancel-subscription",
    )?.body.userId,
  ).toBe(uid);
});
