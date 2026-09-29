import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
    timezoneId: "Europe/Madrid",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  projects: [
    {
      name: "app-desktop",
      testMatch: /app.spec.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3100" },
    },
    {
      name: "app-mobile",
      testMatch: /app.spec.ts/,
      use: { ...devices["Pixel 7"], baseURL: "http://127.0.0.1:3100" },
    },
    {
      name: "landing-desktop",
      testMatch: /landing.spec.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3101" },
    },
    {
      name: "landing-mobile",
      testMatch: /landing.spec.ts/,
      use: { ...devices["Pixel 7"], baseURL: "http://127.0.0.1:3101" },
    },
  ],
  webServer: ["secondbrain", "secondbrain-landing"].map((workspace, index) => ({
    command: `node scripts/start-test-server.mjs ${workspace}`,
    url: `http://127.0.0.1:${3100 + index}`,
    reuseExistingServer: false,
    timeout: 60_000,
  })),
});
