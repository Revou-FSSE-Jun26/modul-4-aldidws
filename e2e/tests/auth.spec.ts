import { test, expect } from "../fixtures/auth.fixture";
import { newAccount } from "../fixtures/test-data.fixture";
import { DashboardPage } from "../pages/DashboardPage";
import { Header } from "../pages/Header";
import { LoginPage } from "../pages/LoginPage";

test("registering through the form sends the user to sign in", async ({ page }) => {
  const account = newAccount();
  await page.goto("/register");
  await page.getByLabel("Name").fill(account.name);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByLabel("Confirm password").fill(account.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/login$/);

  const login = new LoginPage(page);
  await login.signIn(account.email, account.password);
  await expect(page).toHaveURL("/");
});

test("valid login lands on the dashboard", async ({ page, account }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.signIn(account.email, account.password);

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "My Boards" })).toBeVisible();
});

test("invalid credentials show an error and stay on /login", async ({ page, account }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.signIn(account.email, "WrongPass99");

  await expect(login.error).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("a protected page redirects to /login and returns after sign in", async ({ page, account }) => {
  await page.goto("/my-tasks");
  await expect(page).toHaveURL(/\/login\?next=%2Fmy-tasks$/);

  const login = new LoginPage(page);
  await login.signIn(account.email, account.password);
  await expect(page).toHaveURL(/\/my-tasks$/);
});

test("after logout the dashboard redirects to /login", async ({ page, loggedInAccount }) => {
  void loggedInAccount;
  await new Header(page).logout();
  await expect(page).toHaveURL(/\/login$/);

  await new DashboardPage(page).goto();
  await expect(page).toHaveURL(/\/login/);
});
