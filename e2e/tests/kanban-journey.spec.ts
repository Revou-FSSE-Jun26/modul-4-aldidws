import { test, expect } from "../fixtures/auth.fixture";
import { uniqueName } from "../fixtures/test-data.fixture";
import { BoardPage } from "../pages/BoardPage";
import { CardModal } from "../pages/CardModal";
import { DashboardPage } from "../pages/DashboardPage";
import { Header } from "../pages/Header";
import { LoginPage } from "../pages/LoginPage";

/**
 * The full Kanban journey on the real UI.
 *
 * A reload clears the in-memory token, so the app sends the user to
 * /login?next=<board>. After signing in again the card must still be in the
 * second column, which proves the move was saved by the server.
 */
test("kanban journey: board, columns, card, comments, search, bell, drag, reload", async ({
  page,
  loggedInAccount,
}) => {
  test.setTimeout(120_000); // the bell step waits for the 30 s notification poll
  const boardName = uniqueName("Journey");
  const card = "Ship the demo";
  const dashboard = new DashboardPage(page);
  const board = new BoardPage(page);
  const header = new Header(page);

  await test.step("create a board and open it", async () => {
    await dashboard.createBoard(boardName);
    await dashboard.openBoard(boardName);
  });
  const boardUrl = new URL(page.url()).pathname;

  await test.step("add two columns and a card", async () => {
    await board.addColumn("To do");
    await board.addColumn("Done");
    await board.addCard("To do", card);
  });

  await test.step("comment twice and edit one comment", async () => {
    await board.openCard(card);
    const modal = new CardModal(page, card);
    await modal.addComment("First comment");
    await modal.addComment("Second comment");
    await modal.editComment("Second comment", "Second comment, edited");
    await modal.close();
  });

  await test.step("search finds the card", async () => {
    await board.searchFor("demo");
    await expect(board.searchResults).toContainText(card);
    await board.searchFor("");
  });

  await test.step("the bell counts unread comments and marking one read lowers it", async () => {
    await header.expectUnread(2);
    await header.markFirstNotificationRead();
    await header.expectUnread(1);
  });

  await test.step("drag the card to the second column", async () => {
    await board.dragCardToColumn(card, "Done");
    await expect(board.cardIn("Done", card)).toBeVisible();
    await expect(board.cardIn("To do", card)).toHaveCount(0);
  });

  await test.step("reload, sign in again, the card is still in the second column", async () => {
    await page.reload();
    await expect(page).toHaveURL(/\/login\?next=/);

    const login = new LoginPage(page);
    await login.signIn(loggedInAccount.email, loggedInAccount.password);
    await expect(page).toHaveURL(boardUrl);
    await expect(board.cardIn("Done", card)).toBeVisible();
    await expect(board.cardIn("To do", card)).toHaveCount(0);
  });
});
