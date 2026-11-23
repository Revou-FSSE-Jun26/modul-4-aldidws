import { test, expect } from "@playwright/test";

/**
 * Kanban board journey — single sequential E2E test.
 *
 * Runs in the 'chromium' project which starts pre-authenticated via the
 * storage state saved by auth.setup.ts.
 *
 * Locator rules:
 *   - getByRole()    for semantic elements (buttons, headings, textboxes, listitem …)
 *   - getByTestId()  for data-testid attributes where role is insufficient
 *   - Zero waitForTimeout() calls — all waiting is implicit via Playwright's
 *     built-in auto-waiting on locators and assertions.
 *
 * Steps:
 *   1. Create a new board, assert it appears on the home page.
 *   2. Add two columns, assert both appear.
 *   3. Add a card to column 1, assert it appears.
 *   4. Click the card to open CardDetailModal, assert the modal is visible.
 *   5. Add a comment, assert it appears in CommentList.
 *   6. Capture data-updated-at before edit, edit the comment, assert the
 *      timestamp changed (after !== before).
 *   7. Delete the comment (assert 0 items), register dialog handler before
 *      clicking delete-card, delete the card, assert 0 cards.
 *   8. (Optional) Create a second card, drag it from column 1 to column 2,
 *      reload, assert it stays in column 2.
 */

const BOARD_NAME = `Test Board ${Date.now()}`;
const COL_1 = "To Do";
const COL_2 = "In Progress";
const CARD_TITLE = "My Test Card";
const COMMENT_BODY = "Initial comment text";
const EDITED_COMMENT_BODY = "Edited comment text";

test("kanban board journey", async ({ page }) => {
  // -------------------------------------------------------------------------
  // Step 1 — Create a new board and assert it appears on the home page
  // -------------------------------------------------------------------------

  await page.goto("/");

  // Click "Create board" button (the UI must expose this accessible name).
  await page.getByRole("button", { name: /create board/i }).click();

  // Fill the board name input inside the create-board dialog / form.
  await page.getByRole("textbox", { name: /board name/i }).fill(BOARD_NAME);
  await page.getByRole("button", { name: /^create$|^save$/i }).click();

  // The new board card should appear in the boards list.
  await expect(page.getByRole("link", { name: BOARD_NAME })).toBeVisible();

  // -------------------------------------------------------------------------
  // Step 2 — Navigate to the board and add two columns
  // -------------------------------------------------------------------------

  await page.getByRole("link", { name: BOARD_NAME }).click();
  await expect(page).toHaveURL(/\/boards\//);

  // Add column 1
  await page.getByRole("button", { name: /add column/i }).click();
  await page.getByRole("textbox", { name: /column name/i }).fill(COL_1);
  await page.getByRole("button", { name: /^add$|^save$/i }).click();
  await expect(page.getByRole("heading", { name: COL_1 })).toBeVisible();

  // Add column 2
  await page.getByRole("button", { name: /add column/i }).click();
  await page.getByRole("textbox", { name: /column name/i }).fill(COL_2);
  await page.getByRole("button", { name: /^add$|^save$/i }).click();
  await expect(page.getByRole("heading", { name: COL_2 })).toBeVisible();

  // -------------------------------------------------------------------------
  // Step 3 — Add a card to column 1 and assert it appears
  // -------------------------------------------------------------------------

  // The "Add card" button lives inside the column whose heading is COL_1.
  // We scope to that column region by its accessible heading.
  const col1Region = page.getByRole("region", { name: COL_1 });
  await col1Region.getByRole("button", { name: /add card/i }).click();

  await page.getByRole("textbox", { name: /card title/i }).fill(CARD_TITLE);
  await page.getByRole("button", { name: /^add card$|^save$/i }).click();

  // The card should appear as a listitem inside column 1.
  await expect(col1Region.getByRole("listitem", { name: CARD_TITLE })).toBeVisible();

  // -------------------------------------------------------------------------
  // Step 4 — Click the card to open CardDetailModal; assert modal is visible
  // -------------------------------------------------------------------------

  await col1Region.getByRole("button", { name: new RegExp(`Open card: ${CARD_TITLE}`, "i") }).click();

  // BaseModal renders with role="dialog" and aria-labelledby pointing to the title.
  const modal = page.getByRole("dialog", { name: CARD_TITLE });
  await expect(modal).toBeVisible();

  // -------------------------------------------------------------------------
  // Step 5 — Add a comment and assert it appears in CommentList
  // -------------------------------------------------------------------------

  await modal.getByRole("textbox", { name: /add a comment/i }).fill(COMMENT_BODY);
  await modal.getByRole("button", { name: /post comment/i }).click();

  // Comment should appear as a listitem inside the Comments section.
  const commentItems = page.getByTestId("comment-item");
  await expect(commentItems).toHaveCount(1);
  await expect(commentItems.first()).toContainText(COMMENT_BODY);

  // -------------------------------------------------------------------------
  // Step 6 — Capture data-updated-at before edit, edit, assert timestamp changed
  // -------------------------------------------------------------------------

  // Capture the initial updated-at value from the DOM attribute.
  const updatedAtBefore = await commentItems.first().getAttribute("data-updated-at");
  expect(updatedAtBefore).not.toBeNull();

  // Click the edit button on the comment.
  await commentItems.first().getByRole("button", { name: /edit/i }).click();

  // Clear the textarea and type the edited text.
  const editTextarea = commentItems.first().getByRole("textbox");
  await editTextarea.fill(EDITED_COMMENT_BODY);
  await commentItems.first().getByRole("button", { name: /save/i }).click();

  // Wait for the edited text to appear so we know the update completed.
  await expect(commentItems.first()).toContainText(EDITED_COMMENT_BODY);

  // The server increments updated_at on edit; the DOM attribute should differ.
  const updatedAtAfter = await commentItems.first().getAttribute("data-updated-at");
  expect(updatedAtAfter).not.toBe(updatedAtBefore);

  // -------------------------------------------------------------------------
  // Step 7 — Delete the comment, then delete the card
  // -------------------------------------------------------------------------

  // Delete the comment.
  await commentItems.first().getByRole("button", { name: /delete comment/i }).click();
  await expect(page.getByTestId("comment-item")).toHaveCount(0);

  // Close the modal before interacting with the card-level delete action.
  await page.getByRole("button", { name: /close modal/i }).click();
  await expect(modal).not.toBeVisible();

  // Register dialog (window.confirm) handler BEFORE clicking delete so it is
  // already attached when the browser fires the dialog event.
  page.on("dialog", (dialog) => dialog.accept());

  // Click the delete button on the card in column 1.
  await col1Region.getByRole("listitem", { name: CARD_TITLE })
    .getByRole("button", { name: /delete card/i })
    .click();

  // The card list inside column 1 should now be empty.
  await expect(col1Region.getByRole("listitem")).toHaveCount(0);

  // -------------------------------------------------------------------------
  // Step 8 (optional) — Drag a card from column 1 to column 2; assert after reload
  // -------------------------------------------------------------------------

  // Create a second card in column 1 to use as the drag source.
  await col1Region.getByRole("button", { name: /add card/i }).click();
  await page.getByRole("textbox", { name: /card title/i }).fill("Drag Me");
  await page.getByRole("button", { name: /^add card$|^save$/i }).click();

  const dragCard = col1Region.getByRole("listitem", { name: "Drag Me" });
  await expect(dragCard).toBeVisible();

  const col2Region = page.getByRole("region", { name: COL_2 });

  // dragTo() performs a full HTML5 drag-and-drop sequence.
  await dragCard.dragTo(col2Region);

  // After the drag, the card should appear in column 2.
  await expect(col2Region.getByRole("listitem", { name: "Drag Me" })).toBeVisible();

  // Reload and confirm the move persisted.
  await page.reload();
  const col2AfterReload = page.getByRole("region", { name: COL_2 });
  await expect(col2AfterReload.getByRole("listitem", { name: "Drag Me" })).toBeVisible();
});
