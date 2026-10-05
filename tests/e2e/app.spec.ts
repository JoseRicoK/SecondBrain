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
    "statistics/analytics?userId=foreign",
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
  await expect(page.getByText("Amiga", { exact: true }).last()).toBeVisible();
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
  await expect(
    page.getByRole("heading", { name: "Las personas de tu historia" }),
  ).toBeVisible();
  await noHorizontalOverflow(page);
});
test("statistics period changes query graphs without another charged report", async ({
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
  const reports = backend.calls.filter(
    (call) => call.path === "/api/statistics/report",
  ).length;
  await page
    .getByRole("combobox", { name: "Periodo de estadísticas" })
    .selectOption("30");
  await expect
    .poll(
      () =>
        backend.calls.filter(
          (call) => call.path === "/api/statistics/analytics",
        ).length,
    )
    .toBeGreaterThan(1);
  expect(
    backend.calls.filter((call) => call.path === "/api/statistics/report"),
  ).toHaveLength(reports);
  await noHorizontalOverflow(page);
});
test("free statistics show an upgrade requirement without graph data", async ({
  page,
  backend,
}) => {
  backend.tables.subscriptions[0].plan = "free";
  backend.tables.subscriptions[0].status = "inactive";
  await signIn(page);
  await page.goto("/");
  await openSidebar(page);
  await page.getByRole("button", { name: /Estadísticas/ }).click();
  await expect(
    page.getByRole("link", { name: /Mejorar mi plan/ }),
  ).toBeVisible();
  expect(
    backend.calls.filter((call) => call.path.startsWith("/api/statistics/")),
  ).toHaveLength(0);
  const preview = page.locator("[inert]");
  await expect(preview).toHaveAttribute("aria-hidden", "true");
  await expect(preview).toHaveCSS("filter", "blur(5px)");
  await noHorizontalOverflow(page);
  await page.getByRole("link", { name: /Mejorar mi plan/ }).click();
  await expect(page).toHaveURL(/\/subscription/);
});
test("chat success updates the usage displayed by settings", async ({
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
  await input.fill("Hola");
  await input.press("Enter");
  await expect(
    page.getByText("Puedes reflexionar sobre tus relaciones."),
  ).toBeVisible();
  await expect.poll(() => backend.usage.personalChatMessages).toBe(3);
  await page.getByTitle("Cerrar chat").click();
  await openSidebar(page);
  await page.getByRole("button", { name: /Configuración/ }).click();
  await expect(page.getByText(/La cuota se renueva el/)).toBeVisible();
  await expect
    .poll(
      () =>
        backend.calls.filter((call) => call.path === "/api/subscription/status")
          .length,
    )
    .toBeGreaterThan(1);
});
test("subscription preserves plans but cannot start real checkout", async ({
  page,
  backend,
}) => {
  await signIn(page);
  backend.tables.subscriptions[0].plan = "free";
  backend.tables.subscriptions[0].status = "inactive";
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
test("feedback persistence failure shows an error and preserves the draft", async ({
  page,
  backend,
}) => {
  backend.feedbackError = true;
  await signIn(page);
  await page.goto("/");
  await openSidebar(page);
  await page.getByRole("button", { name: /Configuración/ }).click();
  await page
    .getByPlaceholder("Comparte tus ideas para mejorar la aplicación...")
    .fill("Mi sugerencia");
  await page.getByRole("button", { name: "Enviar Sugerencia" }).click();
  await expect(
    page.getByText("No se pudo guardar tu mensaje. Inténtalo de nuevo."),
  ).toBeVisible();
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

test("signup URL without a selected plan opens registration", async ({
  page,
  backend,
}) => {
  await page.goto("/signup");
  await expect(page.getByLabel("Nombre")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Registrarse", exact: true }),
  ).toBeVisible();
});
test("plan cards can be selected using a keyboard while payments stay disabled", async ({
  page,
  backend,
}) => {
  await signIn(page);
  await page.goto("/subscription");
  const elite = page.getByRole("button", {
    name: "Seleccionar plan Elite",
    exact: true,
  });
  await elite.focus();
  await page.keyboard.press("Enter");
  await expect(elite).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByText(/Los pagos estarán disponibles próximamente/),
  ).toBeVisible();
  await noHorizontalOverflow(page);
  await expect(
    page.getByRole("heading", { name: /Un espacio para ti/ }),
  ).toBeVisible();
  await expect(
    page.getByText("10 mensajes de chat personal por mes", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("150 mensajes con personas por mes", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `output/subscription-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await noHorizontalOverflow(page);
  await page.screenshot({
    path: `output/subscription-narrow-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("statistics AI reports require an explicit action and charge exactly once", async ({
  page,
  backend,
}) => {
  await signIn(page);
  await page.goto("/");
  await openSidebar(page);
  await page.getByRole("button", { name: /Estadísticas/ }).click();
  await expect(
    page.getByRole("heading", { name: "Las personas de tu historia" }),
  ).toBeVisible();
  expect(
    backend.calls.filter((c) => c.path === "/api/statistics/report"),
  ).toHaveLength(0);
  const before = backend.usage.statisticsAccess;
  await page.getByRole("button", { name: "Regenerar informe semanal" }).click();
  await expect.poll(() => backend.usage.statisticsAccess).toBe(before + 1);
  expect(
    backend.calls.filter((c) => c.path === "/api/statistics/report"),
  ).toHaveLength(1);
  await noHorizontalOverflow(page);
});
test("statistics report quota exhaustion retains paid graphs and person navigation", async ({
  page,
  backend,
}) => {
  backend.tables.subscriptions[0].plan = "pro";
  backend.usage.statisticsAccess = 10;
  await signIn(page);
  await page.goto("/");
  await openSidebar(page);
  await page.getByRole("button", { name: /Estadísticas/ }).click();
  await expect(
    page.getByRole("heading", { name: "Las personas de tu historia" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Regenerar informe semanal" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Ana: 1 entradas" }).click();
  await page.getByRole("button", { name: "Ver ficha de Ana" }).click();
  await expect(
    page.getByRole("button", { name: "Chat con Ana" }),
  ).toBeVisible();
  expect(
    backend.calls.filter((c) => c.path === "/api/statistics/report"),
  ).toHaveLength(0);
});

test("statistics opens a distant canonical person card and scrolls it into view", async ({
  page,
  backend,
}) => {
  backend.tables.subscriptions[0].plan = "pro";
  const base = backend.tables.people[0];
  backend.tables.people = [
    ...Array.from({ length: 24 }, (_, i) => ({
      ...base,
      id: `person-${i}`,
      name: `A persona ${i}`,
    })),
    {
      ...base,
      id: "mother",
      name: "Mamá",
      details: {
        relacion: { entries: [{ value: "madre", date: "2026-09-30" }] },
      },
    },
  ];
  backend.tables.diary_entries[0].mentioned_people = ["MAMÁ"];
  await signIn(page);
  await page.goto("/");
  await openSidebar(page);
  await page.getByRole("button", { name: /Estadísticas/ }).click();
  await expect(
    page.getByRole("heading", { name: "El color de tus días" }),
  ).toBeVisible();
  await expect(page.getByText("Mejor racha del periodo")).toHaveCount(0);
  await expect(page.getByText("Ver todas las personas")).toHaveCount(0);
  await page
    .getByRole("button", { name: "MAMÁ: 1 entradas", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ver ficha de MAMÁ", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Chat con Mamá", exact: true }),
  ).toBeInViewport();
});

test("statistics person emotions and shared memories open the actual diary without AI", async ({
  page,
  backend,
}) => {
  backend.tables.diary_entries[0].mentioned_people = ["Ana", "Luis"];
  backend.tables.diary_entries[0].content =
    "Ana y Luis vinieron a merendar. Me sentí muy tranquila.";
  const before = backend.usage.statisticsAccess;
  await signIn(page);
  await page.goto("/");
  await openSidebar(page);
  await page.getByRole("button", { name: /Estadísticas/ }).click();
  await page
    .getByRole("button", { name: "Ana: 1 entradas", exact: true })
    .click();
  const personEmotions = page.getByRole("region", {
    name: "Emociones en entradas con Ana",
  });
  await expect(
    personEmotions.getByText("1 de 1 entradas analizadas"),
  ).toBeVisible();
  await expect(personEmotions.getByText(/^Calma/).first()).toBeVisible();
  await personEmotions
    .getByRole("button", {
      name: "Ver entradas con Ana por Felicidad",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Abrir entrada con Ana del/ })
    .click();
  await expect(
    page.getByText(backend.tables.diary_entries[0].content, { exact: true }),
  ).toBeVisible();
  await openSidebar(page);
  await page.getByRole("button", { name: /Estadísticas/ }).click();
  await page
    .getByRole("button", { name: "Conexiones de Ana", exact: true })
    .click();
  const connection = page.getByRole("button", {
    name: "Ver conexión entre Ana y Luis: 1 entradas",
    exact: true,
  });
  await connection.click();
  await expect(
    page.getByRole("heading", { name: "Ana y Luis", exact: true }),
  ).toBeInViewport();
  await expect
    .poll(
      () =>
        backend.calls.filter(
          (call) => call.path === "/api/statistics/connections",
        ).length,
    )
    .toBe(1);
  await noHorizontalOverflow(page);
  await page
    .getByRole("button", { name: /Abrir recuerdo con Ana y Luis del/ })
    .click();
  await expect(
    page.getByText(backend.tables.diary_entries[0].content, { exact: true }),
  ).toBeVisible();
  expect(
    backend.calls.filter((call) => call.path === "/api/statistics/report"),
  ).toHaveLength(0);
  expect(backend.usage.statisticsAccess).toBe(before);
});

test("statistics emotion popup ranks all history, paginates, switches emotion and closes with Escape", async ({
  page,
  backend,
}) => {
  const base = backend.tables.diary_entries[0];
  backend.tables.diary_entries = [
    base,
    ...Array.from({ length: 14 }, (_, i) => ({
      ...base,
      id: `entry-${i}`,
      date: `2026-08-${String(i + 1).padStart(2, "0")}`,
      happiness: 70 + i,
      tranquility: 99 - i,
    })),
    {
      ...base,
      id: "old",
      date: "2020-01-01",
      content: "Un recuerdo antiguo con Ana.",
      happiness: 99,
      tranquility: 10,
    },
  ];
  await signIn(page);
  await page.goto("/");
  await openSidebar(page);
  await page.getByRole("button", { name: /Estadísticas/ }).click();
  await page
    .getByRole("button", {
      name: "Ver entradas con Ana por Felicidad",
      exact: true,
    })
    .click();
  const popup = page.getByRole("dialog");
  const entries = popup.getByRole("button", {
    name: /Abrir entrada con Ana del/,
  });
  await expect(entries).toHaveCount(12);
  await expect(entries.first()).toHaveAccessibleName(
    "Abrir entrada con Ana del 1 ene 2020",
  );
  await popup.getByRole("button", { name: "Cargar más entradas" }).click();
  await expect(entries).toHaveCount(16);
  await popup.getByRole("button", { name: "Calma", exact: true }).click();
  await expect(
    popup.getByRole("heading", { name: "Entradas con más calma" }),
  ).toBeVisible();
  await expect(entries.first()).toHaveAccessibleName(
    "Abrir entrada con Ana del 1 ago 2026",
  );
  await noHorizontalOverflow(page);
  await popup.press("Escape");
  await expect(popup).not.toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Ver entradas con Ana por Felicidad",
      exact: true,
    }),
  ).toBeFocused();
  expect(
    backend.calls.filter((call) => call.path === "/api/statistics/report"),
  ).toHaveLength(0);
});

test("people cards accommodate long names and date histories with keyboard-accessible headers", async ({
  page,
  backend,
}) => {
  backend.tables.people[0].name = "madre de Vero con un nombre largo";
  backend.tables.people[0].details = {
    relacion: { entries: [{ value: "Madre", date: "2025-09-22" }] },
    detalles: {
      entries: [
        {
          value:
            "La exposición sobre Cleopatra es una sorpresa para ella y queremos recordarla.",
          date: "2025-09-22",
        },
      ],
    },
  };
  await signIn(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Abrir panel de personas", exact: true })
    .first()
    .click();
  const header = page.getByRole("button", {
    name: /madre de Vero con un nombre largo Madre/,
  });
  await header.press("Enter");
  await expect(header).toHaveAttribute("aria-expanded", "true");
  const chat = page.getByRole("button", {
    name: "Chat con madre de Vero con un nombre largo",
    exact: true,
  });
  const edit = page
    .getByRole("button", { name: "Editar", exact: true })
    .filter({ visible: true })
    .last();
  await expect(chat).toBeInViewport();
  await expect(edit).toBeInViewport();
  await expect(
    page.getByText(
      "La exposición sobre Cleopatra es una sorpresa para ella y queremos recordarla.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.locator('time[datetime="2025-09-22"]').first(),
  ).toBeVisible();
  await noHorizontalOverflow(page);
});

test("admin dashboard denies members and has no navigation entry", async ({
  page,
  backend,
  request,
}) => {
  await signIn(page);
  await page.goto("/dashboard");
  await expect(
    page.getByText("Tu cuenta no tiene permisos de administrador."),
  ).toBeVisible();
  expect(
    backend.calls.filter((call) =>
      /dashboard\/(users|feedback)/.test(call.path),
    ),
  ).toHaveLength(0);
  for (const path of [
    "dashboard/overview",
    "dashboard/users",
    "dashboard/feedback",
    "dashboard/reanalysis",
  ])
    expect((await request.get("/api/" + path)).status()).toBe(401);
  await page.goto("/");
  await openSidebar(page);
  await expect(
    page.getByRole("button", { name: /Administración|Dashboard/ }),
  ).toHaveCount(0);
});
test("admin dashboard shows overview and filters users with accessible detail", async ({
  page,
  backend,
}) => {
  backend.tables.profiles[0].admin = true;
  await signIn(page);
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Todo bajo control." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Catálogo de planes" }),
  ).toBeVisible();
  await noHorizontalOverflow(page);
  await page.screenshot({
    path: `/tmp/secondbrain-admin-${test.info().project.name}.png`,
    fullPage: false,
  });
  await page.getByRole("button", { name: "Usuarios", exact: true }).click();
  await expect(
    page.getByText("ana@test.invalid", { exact: true }).last(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ver ficha de Ana Pruebas" }).click();
  const dialog = page.getByRole("dialog", { name: "Ana Pruebas" });
  await expect(dialog.getByText("Plan con acceso actual")).toBeVisible();
  await expect(
    dialog.getByText("Consumo de los últimos 6 meses"),
  ).toBeVisible();
  await noHorizontalOverflow(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.getByLabel("Buscar usuarios").fill("nadie");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(
    page.getByText("No hay usuarios que coincidan con estos filtros."),
  ).toBeVisible();
});
test("settings stores report even if email fails and admin can triage it", async ({
  page,
  backend,
}) => {
  backend.emailError = true;
  await signIn(page);
  await page.goto("/");
  await openSidebar(page);
  await page.getByRole("button", { name: /Configuración/ }).click();
  await page
    .getByLabel("Describe el problema")
    .fill("Error sintético: no puedo abrir mi calendario");
  await page
    .getByRole("button", { name: "Reportar Problema", exact: true })
    .click();
  await expect(
    page.getByText(/reporte ha sido enviado correctamente y guardado/),
  ).toBeVisible();
  expect(backend.tables.feedback_reports).toHaveLength(1);
  backend.tables.profiles[0].admin = true;
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Bandeja", exact: true }).click();
  await page
    .getByRole("button", { name: "Revisar error de Ana Pruebas" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Error", exact: true });
  await expect(
    dialog.getByText("Error sintético: no puedo abrir mi calendario"),
  ).toBeVisible();
  await dialog.getByLabel("Estado", { exact: true }).selectOption("resolved");
  await dialog.getByLabel("Prioridad", { exact: true }).selectOption("high");
  await dialog.getByLabel("Notas internas").fill("Comprobado y corregido");
  await dialog.getByRole("button", { name: "Guardar seguimiento" }).click();
  await expect(dialog).toHaveCount(0);
  expect(backend.tables.feedback_reports[0]).toMatchObject({
    status: "resolved",
    priority: "high",
    admin_notes: "Comprobado y corregido",
  });
  await noHorizontalOverflow(page);
});

test("subscription settings return opens the actual settings screen", async ({
  page,
  backend,
}) => {
  await signIn(page);
  await page.goto("/?settings=true");
  await expect(page.getByLabel("Tu sugerencia")).toBeVisible();
});
test("revoking admin permission removes the dashboard data", async ({
  page,
  backend,
}) => {
  backend.tables.profiles[0].admin = true;
  await signIn(page);
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Catálogo de planes" }),
  ).toBeVisible();
  backend.tables.profiles[0].admin = false;
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(
    page.getByText("Tu cuenta no tiene permisos de administrador."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Catálogo de planes" }),
  ).toHaveCount(0);
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 740, height: 360 },
]) {
  test(`mobile administration fits long content at ${viewport.width}x${viewport.height}`, async ({
    page,
    backend,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "app-mobile", "Mobile layout coverage");
    await page.setViewportSize(viewport);
    const name =
      "Administradora con un nombre muy largo y varios apellidos que necesita varias líneas en su ficha";
    const email =
      "administradora.con.un.correo.muy.largo@pruebas.segundo.cerebro.test.invalid";
    Object.assign(backend.tables.profiles[0], {
      admin: true,
      display_name: name,
      email,
    });
    backend.tables.feedback_reports.push({
      id: "f67d18ac-3ebe-49e8-bfde-c10607731a7e",
      user_id: uid,
      type: "problem",
      status: "open",
      priority: "urgent",
      message:
        "Texto de prueba con una palabra larga: " +
        "detalle".repeat(80) +
        "\n" +
        "Pasos para reproducir el error. ".repeat(40),
      email,
      display_name: name,
      admin_notes: "",
      updated_by: null,
      created_at: "2026-10-01T10:00:00Z",
      updated_at: "2026-10-01T10:00:00Z",
    });
    await signIn(page);
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Catálogo de planes" }),
    ).toBeVisible();
    await noHorizontalOverflow(page);
    Object.assign(backend.tables.profiles[0], { display_name: name, email });
    await page.getByRole("button", { name: "Usuarios", exact: true }).click();
    const search = page.getByLabel("Buscar usuarios");
    await expect(search).toBeVisible();
    await noHorizontalOverflow(page);
    expect(
      await search.evaluate((element) =>
        parseFloat(getComputedStyle(element).fontSize),
      ),
    ).toBeGreaterThanOrEqual(16);
    await page.getByRole("button", { name: `Ver ficha de ${name}` }).click();
    const detail = page.getByRole("dialog", { name });
    await expect(
      detail.getByText("Consumo de los últimos 6 meses"),
    ).toBeVisible();
    const bounds = await detail.evaluate((dialog) => {
      const box = dialog.getBoundingClientRect();
      const body = dialog.lastElementChild!.getBoundingClientRect();
      const close = dialog
        .querySelector('button[aria-label="Cerrar ventana"]')!
        .getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        bodyBottom: body.bottom,
        closeWidth: close.width,
        closeHeight: close.height,
        width: innerWidth,
        height: innerHeight,
      };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.width);
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.height);
    expect(bounds.bodyBottom).toBeLessThanOrEqual(bounds.bottom + 1);
    expect(bounds.closeWidth).toBeGreaterThanOrEqual(44);
    expect(bounds.closeHeight).toBeGreaterThanOrEqual(44);
    await detail.getByRole("button", { name: "Cerrar ventana" }).click();
    await page.getByRole("button", { name: "Bandeja", exact: true }).click();
    await page
      .getByRole("button", { name: `Revisar error de ${name}` })
      .click();
    const report = page.getByRole("dialog", { name: "Error", exact: true });
    await report.getByLabel("Notas internas").fill("Revisión móvil completada");
    for (const control of [
      report.getByLabel("Estado", { exact: true }),
      report.getByLabel("Notas internas"),
    ]) {
      expect(
        await control.evaluate((element) =>
          parseFloat(getComputedStyle(element).fontSize),
        ),
      ).toBeGreaterThanOrEqual(16);
    }
    if (viewport.width === 390)
      await page.screenshot({
        path: "/tmp/secondbrain-mobile-report.png",
        scale: "css",
      });
    await report.getByRole("button", { name: "Guardar seguimiento" }).click();
    await expect(report).toHaveCount(0);
    expect(backend.tables.feedback_reports[0].admin_notes).toBe(
      "Revisión móvil completada",
    );
    await noHorizontalOverflow(page);
    await page.goto("/?settings=true");
    await expect(page.getByLabel("Tu sugerencia")).toBeVisible();
    await page.getByLabel("Tu sugerencia").fill("Sugerencia móvil de prueba");
    await page
      .getByLabel("Describe el problema")
      .fill("Borrador móvil de prueba");
    await noHorizontalOverflow(page);
    for (const label of ["Tu sugerencia", "Describe el problema"]) {
      const area = page.getByLabel(label);
      await area.scrollIntoViewIfNeeded();
      const box = await area.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(
        await area.evaluate((element) =>
          parseFloat(getComputedStyle(element).fontSize),
        ),
      ).toBeGreaterThanOrEqual(16);
    }
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    const cancellation = page.getByRole("dialog", {
      name: "Cancelar suscripción",
      exact: true,
    });
    await expect(cancellation).toBeVisible();
    const box = await cancellation.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    await cancellation
      .getByRole("button", { name: "Mantener suscripción" })
      .click();
    await expect(cancellation).toHaveCount(0);
    expect(
      backend.calls.some(
        (call) => call.path === "/api/stripe/cancel-subscription",
      ),
    ).toBe(false);
    await page
      .getByRole("button", { name: "Eliminar mi cuenta", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Confirmar Eliminación" }),
    ).toBeDisabled();
    await noHorizontalOverflow(page);
  });
}

test("neutral emotion toggles, colours the calendar and ranks person entries without AI", async ({
  page,
  backend,
}, testInfo) => {
  const date = backend.tables.diary_entries[0].date;
  Object.assign(backend.tables.diary_entries[0], {
    content: "Rutina con Ana sin nada destacable.",
    happiness: 0,
    tranquility: null,
    stress: 0,
    sadness: 0,
    neutral: 90,
  });
  backend.tables.diary_entries.push({
    ...backend.tables.diary_entries[0],
    id: "entry-older",
    date: "2020-01-01",
    content: "Un día alegre con Ana.",
    happiness: 80,
    neutral: 0,
  });
  await signIn(page);
  await page.goto("/");
  await openSidebar(page);
  await page.getByRole("button", { name: /Estadísticas/ }).click();
  const filter = page.getByRole("button", { name: /^Neutral.*%/ });
  await expect(filter).toHaveAttribute("aria-pressed", "true");
  await filter.click();
  await expect(filter).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: /^Felicidad.*%/ }),
  ).toHaveAttribute("aria-pressed", "false");
  await filter.click();
  await expect(
    page.getByRole("button", { name: /^Felicidad.*%/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Ver datos emocionales", exact: true })
    .click();
  const table = page.getByRole("table");
  await expect(
    table.getByRole("columnheader", { name: "Neutral", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Neutral · 90\/100/ }),
  ).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Ver entradas con Ana por Neutral",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", {
      name: "Entradas con más neutralidad",
      exact: true,
    }),
  ).toBeVisible();
  const rows = dialog.getByRole("button", {
    name: /Abrir entrada con Ana del/,
  });
  await expect(rows).toHaveCount(2);
  await expect(
    rows.nth(0).getByText("Neutral 90", { exact: true }),
  ).toBeVisible();
  await expect(
    rows.nth(1).getByText("Neutral 0", { exact: true }),
  ).toBeVisible();
  await expect(rows.nth(0).getByText(/^Calma/)).toHaveCount(0);
  await noHorizontalOverflow(page);
  await page.screenshot({
    path: `/tmp/secondbrain-neutral-${testInfo.project.name}.png`,
    scale: "css",
  });
  await dialog
    .getByRole("button", { name: /Abrir entrada con Ana del/ })
    .first()
    .click();
  await expect(
    page.getByText("Rutina con Ana sin nada destacable.", { exact: true }),
  ).toBeVisible();
  expect(
    backend.calls.filter(
      (call) =>
        call.path === "/api/statistics/report" ||
        call.path === "/api/extract-people",
    ),
  ).toHaveLength(0);
});

test("admin reanalysis confirms cost, pauses and resumes saved progress without duplicate starts", async ({
  page,
  backend,
}, testInfo) => {
  backend.tables.profiles[0].admin = true;
  backend.tables.diary_entries[0].mood_analyzed_at = "2026-01-01T00:00:00Z";
  backend.tables.diary_entries.push({
    ...backend.tables.diary_entries[0],
    id: "another-entry",
    date: "2026-01-02",
    content: "Una segunda entrada ficticia",
    mood_analyzed_at: null,
  });
  backend.reanalysisDelay = 500;
  await signIn(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Usuarios", exact: true }).click();
  await page
    .getByRole("button", { name: "Volver a analizar diario de Ana Pruebas" })
    .click();
  let dialog = page.getByRole("dialog", {
    name: "Volver a analizar el diario",
  });
  await expect(dialog.getByText(/Tiene coste de IA/)).toBeVisible();
  expect(
    backend.calls.filter(
      (call) =>
        call.path === "/api/dashboard/reanalysis" && call.method === "POST",
    ),
  ).toHaveLength(0);
  await dialog
    .getByRole("button", { name: "Analizar todas las entradas", exact: true })
    .click();
  await expect(dialog.getByText("Analizando…", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Reanudar", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("1 actualizadas", { exact: true }),
  ).toBeVisible();
  await noHorizontalOverflow(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Volver a analizar diario de Ana Pruebas" })
    .click();
  dialog = page.getByRole("dialog", { name: "Volver a analizar el diario" });
  await expect(
    dialog.getByText("1 actualizadas", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Reanudar", exact: true }).click();
  await expect(
    dialog.getByText("Proceso finalizado", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("2 actualizadas", { exact: true }),
  ).toBeVisible();
  expect(
    backend.calls.filter(
      (call) =>
        call.path === "/api/dashboard/reanalysis" &&
        call.body?.action === "start",
    ),
  ).toHaveLength(1);
  expect(
    backend.calls.filter(
      (call) =>
        call.path === "/api/dashboard/reanalysis" &&
        call.body?.action === "process",
    ),
  ).toHaveLength(2);
  expect(backend.tables.diary_entries).toHaveLength(2);
  expect(backend.tables.people).toHaveLength(2);
  expect(backend.usage.statisticsAccess).toBe(1);
  await noHorizontalOverflow(page);
  await page.screenshot({
    path: `/tmp/secondbrain-reanalysis-${testInfo.project.name}.png`,
    scale: "css",
  });
});

test("emotion timeline retains real recent dates and truthful tooltips after a long empty gap", async ({
  page,
  backend,
}) => {
  const end = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const ago = (days: number) => {
    const value = new Date(`${end}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() - days);
    return value.toISOString().slice(0, 10);
  };
  const label = (date: string) =>
    new Intl.DateTimeFormat("es", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${date}T12:00:00Z`));
  const original = backend.tables.diary_entries[0];
  backend.tables.diary_entries = [
    { ...original, id: "old", date: ago(500), happiness: 80, neutral: null },
    ...[5, 30, 20].map((happiness, index) => ({
      ...original,
      id: `recent-${index}`,
      date: ago(3 - index),
      happiness,
      neutral: [85, 55, 65][index],
    })),
    {
      ...original,
      id: "foreign",
      user_id: "someone-else",
      date: ago(2),
      happiness: 99,
    },
  ];
  await signIn(page);
  await page.goto("/");
  await openSidebar(page);
  await page.getByRole("button", { name: /Estadísticas/ }).click();
  await page.getByRole("button", { name: "Ver datos emocionales" }).click();
  const table = page.getByRole("table").filter({
    has: page.getByText(
      "Intensidades originales (0–100) · fechas reales e intervalos de las medias",
    ),
  });
  for (const [index, happiness] of [5, 30, 20].entries()) {
    const row = table.getByRole("row").filter({
      has: page.getByRole("rowheader", {
        name: label(ago(3 - index)),
        exact: true,
      }),
    });
    await expect(row.getByRole("cell").first()).toHaveText(String(happiness));
  }
  await expect(
    table.getByRole("rowheader", { name: label(ago(5)), exact: true }),
  ).toHaveCount(0);
  await expect(table.getByRole("rowheader", { name: /media de/ })).toHaveCount(
    0,
  );
  await page
    .getByRole("combobox", { name: "Periodo de estadísticas" })
    .selectOption("7");
  const chart = page.getByRole("img", {
    name: "Reparto emocional: columnas apiladas de 0 a 100 %",
  });
  const happinessDots = chart
    .locator(".recharts-bar")
    .last()
    .locator(".recharts-bar-rectangle");
  await expect(happinessDots).toHaveCount(3);
  await chart.scrollIntoViewIfNeeded();
  // Hover waits until the stacked bar's entrance animation has settled.
  await happinessDots.nth(1).hover();
  const tooltip = chart.locator(".recharts-tooltip-wrapper");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText(label(ago(2)));
  await expect(tooltip).toContainText("30/100");
  const percents = await tooltip.locator("b").allTextContents();
  expect(
    percents
      .map((value) => Number(value.replace(" %", "").replace(",", ".")))
      .reduce((sum, value) => sum + value, 0),
  ).toBeCloseTo(100, 8);
  const barCount = await chart.locator(".recharts-bar").count();
  expect(barCount).toBe(5);
  await page.getByRole("button", { name: /^Felicidad.*%/ }).click();
  await expect(chart.locator(".recharts-bar")).toHaveCount(5);
  await noHorizontalOverflow(page);
  await chart.locator("..").screenshot({
    path: `/tmp/secondbrain-timeline-${test.info().project.name}.png`,
  });
  expect(
    backend.calls.filter((call) => call.path === "/api/statistics/report"),
  ).toHaveLength(0);
});
