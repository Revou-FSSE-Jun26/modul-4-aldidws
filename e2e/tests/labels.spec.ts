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
    name: uniqueName("Labels"),
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

test("a label can be created, attached, survives a reload and can be deleted", async ({
  page,
  request,
  account,
}) => {
  const title = uniqueName("Tagged");
  const label = uniqueName("Bug");
  const { board, login } = await openSeededBoard(page, request, account, title);
  await expect(board.labelPill(title, label)).toHaveCount(0);

  await board.openCard(title);
  const modal = new CardModal(page, title);
  await modal.createLabel(label, "Red");
  await modal.setLabels([label]);
  await modal.close();
  await expect(board.labelPill(title, label)).toBeVisible();

  // The token lives in memory only, so a reload sends the user back to login.
  await page.reload();
  await login.signIn(account.email, account.password);
  await expect(board.cardIn("To do", title)).toBeVisible();
  await expect(board.labelPill(title, label)).toBeVisible();

  // Deleting the label removes it from the card.
  await board.openCard(title);
  const reopened = new CardModal(page, title);
  await reopened.dialog.getByRole("button", { name: `Delete label ${label}` }).click();
  const confirm = page.getByRole("dialog", { name: `Delete label "${label}"?` });
  await expect(confirm).toContainText("It will be removed from 1 card.");
  await confirm.getByRole("button", { name: "Confirm delete" }).click();
  await expect(reopened.dialog).toBeVisible();
  await expect(reopened.dialog.getByRole("button", { name: `Edit label ${label}` })).toHaveCount(0);
  await reopened.close();
  await expect(board.labelPill(title, label)).toHaveCount(0);
});

test("a second label with the same name in another case is refused", async ({
  page,
  request,
  account,
}) => {
  const title = uniqueName("Dup");
  const label = uniqueName("Urgent");
  const { board } = await openSeededBoard(page, request, account, title);
  await board.openCard(title);
  const modal = new CardModal(page, title);
  await modal.createLabel(label, "Blue");

  await modal.dialog.getByLabel("New label name").fill(label.toUpperCase());
  await modal.dialog.getByRole("button", { name: "Create label" }).click();

  await expect(modal.dialog.getByRole("alert")).toHaveText("A label with that name already exists.");
});
