import { defineConfig, devices } from "@playwright/test";
import { BASE_URL } from "./utils/env";

/**
 * Playwright configuration (the only one in the repo).
 *
 * The suite runs against LOCAL servers. Start Flask and Next yourself, then:
 *   npx playwright test -c ../e2e/playwright.config.ts      (from frontend/)
 *
 * Environment:
 *   E2E_BASE_URL     frontend URL, default http://localhost:3000
 *   E2E_API_URL      backend URL,  default http://localhost:5000
 *   E2E_ALLOW_REMOTE set to 1 to allow a non-localhost URL (off by default)
 *
 * Auth model: the access token lives in memory only, so there is no
 * storageState. Each test registers its own user through the API and logs in
 * through the UI (see fixtures/auth.fixture.ts).
 */


export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 375, height: 812 },
      },
    },
  ],
});
