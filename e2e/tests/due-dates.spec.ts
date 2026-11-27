import { test, expect } from "../fixtures/auth.fixture";
import { seedBoard, uniqueName } from "../fixtures/test-data.fixture";
import { BoardPage } from "../pages/BoardPage";
import { CardModal } from "../pages/CardModal";
import { LoginPage } from "../pages/LoginPage";

async function openSeededBoard(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
  account: import("../fixtures/test-data.fixture").Account,
  cardTitle: string,
) {
  const seeded = await seedBoard(request, account, {
    name: uniqueName("Due"),
    columns: ["To do"],
    cards: { "To do": [cardTitle] },
  });
  const login = new LoginPage(page);
  await login.goto("/login?next=" + encodeURIComponent(`/boards/${seeded.id}`));
  await login.signIn(account.email, account.password);
  const board = new BoardPage(page);
  await expect(board.cardIn("To do", cardTitle)).toBeVisible();
  return { board, login };
}

test("a due date can be set, survives a reload, and can be removed", async ({
  page,
  request,
  account,
}) => {
  const title = uniqueName("Dated");
  const { board, login } = await openSeededBoard(page, request, account, title);
  await expect(board.dueBadge(title)).toHaveCount(0);

  await board.openCard(title);
  const modal = new CardModal(page, title);
  await modal.setDueDate("2031-07-15T10:30");
  await modal.close();
  await expect(board.dueBadge(title)).toContainText("2031");

  // The token lives in memory only, so a reload sends the user back to login.
  await page.reload();
  await login.signIn(account.email, account.password);
  await expect(board.cardIn("To do", title)).toBeVisible();
  await expect(board.dueBadge(title)).toContainText("2031");

  await board.openCard(title);
  const reopened = new CardModal(page, title);
  await expect(reopened.dueDateInput).toHaveValue("2031-07-15T10:30");
  await reopened.removeDueDate();
  await reopened.close();
  await expect(board.dueBadge(title)).toHaveCount(0);
});

test("a due date in the past shows the Overdue badge", async ({ page, request, account }) => {
  const title = uniqueName("Late");
  const { board } = await openSeededBoard(page, request, account, title);
  await board.openCard(title);
  const modal = new CardModal(page, title);
  await modal.setDueDate("2021-01-02T03:04");
  await modal.close();
  await expect(board.dueBadge(title)).toHaveText("Overdue");
});
