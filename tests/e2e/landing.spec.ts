import { test, expect, noHorizontalOverflow } from "./fixtures";
for (const path of [
  "/",
  "/precios",
  "/soporte",
  "/privacidad",
  "/terminos",
  "/diario-personal-con-ia",
  "/diario-de-voz",
  "/como-empezar-un-diario",
]) {
  test(`public page ${path} loads metadata, heading and responsive content`, async ({
    page,
    backend,
  }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page).toHaveTitle(/SecondBrain/);
    expect(
      await page.locator('meta[name="description"]').getAttribute("content"),
    ).toBeTruthy();
    await noHorizontalOverflow(page);
  });
}
test("header navigation reaches pricing and links to the private app", async ({
  page,
  backend,
}) => {
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Abrir menú" });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("link", { name: "Precios", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/precios$/);
  const appLinks = page.locator('a[href="https://app.secondbrainapp.com"]');
  expect(await appLinks.count()).toBeGreaterThan(0);
});
test("FAQ opens and closes answers", async ({ page, backend }) => {
  await page.goto("/");
  const question = page
    .locator("summary")
    .filter({ hasText: "¿Mis datos están seguros y privados?" });
  await question.click();
  await expect(
    page.getByText(/No hay cifrado de extremo a extremo/),
  ).toBeVisible();
  await question.click();
  await expect(
    page.getByText(/No hay cifrado de extremo a extremo/),
  ).not.toBeVisible();
});
test("SEO endpoints include every public page and block private paths", async ({
  request,
  backend,
}) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  for (const path of ["/precios", "/soporte", "/privacidad", "/terminos"])
    expect(xml).toContain(`https://www.secondbrainapp.com${path}`);
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /api/");
});

test("pricing shows euros, current quotas and an honest disabled checkout", async ({
  page,
  backend,
}) => {
  await page.goto("/precios");
  await expect(page.getByText("9,99", { exact: false }).first()).toBeVisible();
  await expect(
    page.getByText(/todavía no puedes contratar ni pagar/),
  ).toBeVisible();
  const paid = page.getByRole("link", {
    name: /Empezar gratis mientras llega/,
  });
  expect(await paid.count()).toBe(2);
  for (const link of await paid.all())
    expect(await link.getAttribute("href")).toBe(
      "https://app.secondbrainapp.com/signup?plan=free",
    );
});
test("native FAQ is exclusive, keyboard operable and closes", async ({
  page,
  backend,
}) => {
  await page.goto("/");
  const summaries = page.locator("summary");
  await summaries.nth(0).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("details[open]")).toHaveCount(1);
  await summaries.nth(1).click();
  await expect(page.locator("details[open]")).toHaveCount(1);
  await expect(page.locator("details").nth(0)).not.toHaveAttribute("open", "");
});
test("initial HTML includes visible copy and every page has its own canonical", async ({
  request,
  backend,
}) => {
  for (const path of [
    "/",
    "/precios",
    "/privacidad",
    "/terminos",
    "/soporte",
    "/diario-personal-con-ia",
    "/diario-de-voz",
    "/como-empezar-un-diario",
  ]) {
    const response = await request.get(path);
    const html = await response.text();
    expect(html).toContain(
      'rel="canonical" href="https://www.secondbrainapp.com' +
        (path === "/" ? "" : path) +
        '"',
    );
    expect(html).not.toContain('"aggregateRating"');
    expect(html).not.toContain("1250");
    expect(html).not.toContain("priceValidUntil");
    expect(html).toContain('id="main"');
    expect((html.match(/<h1[ >]/g) || []).length).toBe(1);
  }
  expect((await request.get("/guia-inexistente")).status()).toBe(404);
});
test("public content and FAQ are usable with JavaScript disabled", async ({
  browser,
  baseURL,
  backend,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(baseURL + "/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Crear mi diario gratis" }).first(),
    ).toBeVisible();
    await page.locator("summary").first().click();
    await expect(page.locator("details[open]")).toHaveCount(1);
    await noHorizontalOverflow(page);
  } finally {
    await context.close();
  }
});

test("mobile menu Escape returns keyboard focus and closes", async ({
  page,
  backend,
}) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: "Abrir menú" });
  if (await button.isVisible()) {
    await button.click();
    await expect(
      page.getByRole("button", { name: "Cerrar menú" }),
    ).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Abrir menú" }),
    ).toBeFocused();
    await expect(page.locator("#mobile-navigation")).toHaveCount(0);
  }
});

test("product mockup switches every view with keyboard without provider calls", async ({
  page,
  backend,
}) => {
  await page.goto("/");
  const demo = page.getByRole("group", {
    name: "Explorar la demo de SecondBrain",
  });
  for (const [label, heading] of [
    ["Voz", "A veces, es más fácil contarlo."],
    ["Chat IA", "Mira tu día desde otro ángulo."],
    ["Gráficas", "Un poco de perspectiva."],
    ["Diario", "Los pequeños momentos también cuentan."],
  ]) {
    const button = demo.getByRole("button", { name: label, exact: true });
    await button.press("Enter");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await noHorizontalOverflow(page);
  }
  await expect(
    page.getByText("Mockup interactivo · datos ficticios"),
  ).toBeVisible();
  expect(backend.calls).toHaveLength(0);
});

test("product animation controls pause and resume the mockup", async ({
  page,
  backend,
}) => {
  await page.goto("/");
  const scene = page.locator(".product-scene");
  await expect(scene).toHaveAttribute("data-motion", "on");
  await page.getByRole("button", { name: "Pausar animaciones" }).click();
  await expect(scene).toHaveAttribute("data-motion", "off");
  await page
    .getByRole("button", { name: "Activar animaciones" })
    .press("Enter");
  await expect(scene).toHaveAttribute("data-motion", "on");
});

test("reduced motion keeps mockup readable without decorative animation", async ({
  page,
  backend,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".product-scene")).toHaveAttribute(
    "data-motion",
    "off",
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Activar animaciones" }),
  ).toBeVisible();
  expect(
    await page
      .locator(".floating-note")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await noHorizontalOverflow(page);
});
