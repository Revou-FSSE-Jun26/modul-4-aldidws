import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

/**
 * Playwright configuration.
 *
 * Project structure:
 *   setup    — runs auth.setup.ts once to log in and persist storageState
 *   chromium — runs all spec files using the saved auth state
 *
 * Docs: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./tests",
  /* Note: tests moved from frontend/tests/ to e2e/tests/ during repo restructure */
  /* Fail fast in CI; allow parallel locally. */
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [
    // ---- Authentication setup ------------------------------------------------
    // Runs auth.setup.ts once before any test project that depends on it.
    // Saves browser storage state (cookies + localStorage) to a file so
    // authenticated tests can reuse it without logging in on every test.
    // Setup file location: fixtures/auth.setup.ts
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },

    // ---- Chromium (authenticated tests) -------------------------------------
    // Depends on setup finishing first.  Every test in this project starts
    // with the browser pre-authenticated via storageState.
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],

  /* Start the Next.js dev server automatically when running tests. */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
