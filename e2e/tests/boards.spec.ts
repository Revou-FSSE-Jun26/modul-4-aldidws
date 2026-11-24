import { test, expect } from "../fixtures/auth.fixture";
import { newAccount, registerAccount, seedBoard, uniqueName } from "../fixtures/test-data.fixture";
import { BoardPage } from "../pages/BoardPage";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";

test("creating a board shows it as a link and opens it", async ({ page, loggedInAccount }) => {
  void loggedInAccount;
  const dashboard = new DashboardPage(page);
  const name = uniqueName("Roadmap");

  await dashboard.createBoard(name);
  await expect(dashboard.boardLink(name)).toBeVisible();

  await dashboard.openBoard(name);
  await expect(page).toHaveURL(/\/boards\/[0-9a-f-]+$/);
});

test("a duplicate board name is rejected and the input is kept", async ({
  page,
  request,
  account,
}) => {
  const name = uniqueName("Duplicate");
  await seedBoard(request, account, { name, columns: [] });
  const login = new LoginPage(page);
  await login.goto();
  await login.signIn(account.email, account.password);

  const dashboard = new DashboardPage(page);
  await dashboard.createBoard(name.toLowerCase());

  await expect(dashboard.formError).toContainText("already exists");
  await expect(dashboard.boardNameInput).toHaveValue(name.toLowerCase());
});

test("columns can be added, renamed and deleted when empty", async ({
  page,
  request,
  account,
}) => {
  const seeded = await seedBoard(request, account, { name: uniqueName("Columns"), columns: [] });
  const login = new LoginPage(page);
  await login.goto("/login?next=" + encodeURIComponent(`/boards/${seeded.id}`));
  await login.signIn(account.email, account.password);

  const board = new BoardPage(page);
  await expect(board.heading(seeded.name)).toBeVisible();
  await board.addColumn("To do");
  await board.renameColumn("To do", "Backlog");
  await expect(board.column("Backlog")).toBeVisible();

  await board.deleteColumn("Backlog");
  await expect(board.column("Backlog")).toHaveCount(0);
});

test("a column that still has cards cannot be deleted", async ({ page, request, account }) => {
  const seeded = await seedBoard(request, account, {
    name: uniqueName("Busy"),
    columns: ["To do"],
    cards: { "To do": ["Keep me"] },
  });
  const login = new LoginPage(page);
  await login.goto("/login?next=" + encodeURIComponent(`/boards/${seeded.id}`));
  await login.signIn(account.email, account.password);

  const board = new BoardPage(page);
  await expect(board.cardIn("To do", "Keep me")).toBeVisible();
  await board.deleteColumn("To do");

  await expect(
    board.column("To do").getByText("This column still has cards. Move or delete them first."),
  ).toBeVisible();
  await expect(board.cardIn("To do", "Keep me")).toBeVisible();
});

test("another user cannot open someone else's board", async ({ browser, request, account }) => {
  const seeded = await seedBoard(request, account, { name: uniqueName("Private"), columns: ["To do"] });

  const intruder = newAccount();
  await registerAccount(request, intruder);
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const login = new LoginPage(page);
    await login.goto("/login?next=" + encodeURIComponent(`/boards/${seeded.id}`));
    await login.signIn(intruder.email, intruder.password);

    await expect(page.getByText("Board not found.")).toBeVisible();
    await expect(page.getByRole("heading", { name: seeded.name })).toHaveCount(0);
  } finally {
    await context.close();
  }
});
