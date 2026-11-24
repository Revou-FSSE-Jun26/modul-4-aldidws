import { test as base, expect } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";
import { newAccount, registerAccount, type Account } from "./test-data.fixture";

interface Fixtures {
  /** A freshly registered user (created through the API, not yet logged in). */
  account: Account;
  /** The same user, logged in through the UI on the default page. */
  loggedInAccount: Account;
}

/**
 * The access token is kept in memory only, so there is no storageState.
 * Every test gets its own user and logs in through the real login form.
 */
export const test = base.extend<Fixtures>({
  account: async ({ request }, use) => {
    const account = newAccount();
    await registerAccount(request, account);
    await use(account);
  },

  loggedInAccount: async ({ page, account }, use) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(account.email, account.password);
    await expect(page).toHaveURL("/");
    await use(account);
  },
});

export { expect };
