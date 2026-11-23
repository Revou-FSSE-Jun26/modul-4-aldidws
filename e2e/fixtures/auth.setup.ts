import { test as setup, expect } from "@playwright/test";
import path from "path";

/**
 * Authentication setup — runs once before the 'chromium' project.
 *
 * Logs in as the test user, then saves the resulting browser storage state
 * (cookies + localStorage) to playwright/.auth/user.json.  Every test in
 * the 'chromium' project reuses this state so they start pre-authenticated
 * without repeating the login flow.
 *
 * Environment variables consumed:
 *   TEST_USER_EMAIL    — defaults to 'test@example.com'
 *   TEST_USER_PASSWORD — defaults to 'TestPass1!'
 */

const AUTH_FILE = path.join(__dirname, "../playwright/.auth/user.json");

setup("authenticate as test user", async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL ?? "test@example.com";
  const password = process.env.TEST_USER_PASSWORD ?? "TestPass1!";

  await page.goto("/login");

  // Fill the login form using accessible role-based locators.
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByRole("textbox", { name: /password/i }).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for the redirect to the home page — confirms login succeeded.
  await expect(page).toHaveURL("/");

  // Persist the authenticated browser state for downstream tests.
  await page.context().storageState({ path: AUTH_FILE });
});
