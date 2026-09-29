import { test, expect, noHorizontalOverflow } from "./fixtures";
for (const path of ["/", "/precios", "/soporte", "/privacidad", "/terminos"]) {
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
  const question = page.getByRole("button", {
    name: "¿Mis datos están seguros y privados?",
  });
  await question.click();
  await expect(
    page.getByText(/Utilizamos encriptación de nivel empresarial/),
  ).toBeVisible();
  await question.click();
  await expect(
    page.getByText(/Utilizamos encriptación de nivel empresarial/),
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
    expect(xml).toContain(`https://secondbrainapp.com${path}`);
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /api/");
});
