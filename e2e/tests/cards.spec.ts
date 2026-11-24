import { test, expect } from "../fixtures/auth.fixture";
import { seedBoard, uniqueName } from "../fixtures/test-data.fixture";
import { BoardPage } from "../pages/BoardPage";
import { CardModal } from "../pages/CardModal";
import { LoginPage } from "../pages/LoginPage";

/** Seeds a board with two columns and one card, then signs in on its page. */
async function openSeededBoard(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
  account: import("../fixtures/test-data.fixture").Account,
  cardTitle: string,
) {
  const seeded = await seedBoard(request, account, {
    name: uniqueName("Cards"),
    columns: ["To do", "Done"],
    cards: { "To do": [cardTitle] },
  });
  const login = new LoginPage(page);
  await login.goto("/login?next=" + encodeURIComponent(`/boards/${seeded.id}`));
  await login.signIn(account.email, account.password);
  const board = new BoardPage(page);
  await expect(board.cardIn("To do", cardTitle)).toBeVisible();
  return { board, seeded };
}

test("a card can be added to a column", async ({ page, request, account }) => {
  const { board } = await openSeededBoard(page, request, account, "Existing card");
  await board.addCard("Done", "Brand new card");
  await expect(board.cardIn("Done", "Brand new card")).toBeVisible();
});

test("the card title can be edited in the modal", async ({ page, request, account }) => {
  const { board } = await openSeededBoard(page, request, account, "Old title");
  await board.openCard("Old title");
  const modal = new CardModal(page, "Old title");
  await modal.saveTitle("New title");

  await modal.close();
  await expect(board.card("New title")).toBeVisible();
  await expect(board.card("Old title")).toHaveCount(0);
});

test("Move to column moves a card without dragging", async ({ page, request, account }) => {
  const { board } = await openSeededBoard(page, request, account, "Mover");
  await board.openCard("Mover");
  const modal = new CardModal(page, "Mover");
  await modal.moveTo("Done");
  await modal.close();

  await expect(board.cardIn("Done", "Mover")).toBeVisible();
  await expect(board.cardIn("To do", "Mover")).toHaveCount(0);
});

test("a card can be deleted after confirming", async ({ page, request, account }) => {
  const { board } = await openSeededBoard(page, request, account, "Doomed");
  await board.openCard("Doomed");
  await new CardModal(page, "Doomed").deleteCard();

  await expect(board.card("Doomed")).toHaveCount(0);
});

test("comments can be added, edited and deleted", async ({ page, request, account }) => {
  const { board } = await openSeededBoard(page, request, account, "Discuss");
  await board.openCard("Discuss");
  const modal = new CardModal(page, "Discuss");

  await modal.addComment("First thought");
  await modal.editComment("First thought", "Second thought");
  await expect(modal.comment("Second thought")).toContainText("edited");
  await modal.deleteComment("Second thought");
});

test("search finds a card by title", async ({ page, request, account }) => {
  const { board } = await openSeededBoard(page, request, account, "Findable zebra");
  await board.searchFor("zebra");
  await expect(board.searchResults).toContainText("Findable zebra");

  await board.searchFor("nothing-matches-this");
  await expect(page.getByText(/No cards match/)).toBeVisible();
});
