/**
 * B1 Browser Check — Board name shown on kanban cards
 *
 * Verifies that:
 * 1. Board name text appears in the DOM on cards (via aria-label="Board: <name>").
 * 2. CardDetailModal opens when a card is clicked.
 * 3. Board name is still visible after the modal is closed.
 * 4. Board name is still visible after a card is dragged to another column.
 * 5. My Tasks page shows board name text for card items.
 *
 * Screenshots are saved to the same directory as this spec.
 */

import path from "path";
import { test, expect, type Page } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";

const OUTPUT_DIR = path.resolve(__dirname, "../../.agents/tasks/kanban-stage2/b1");

const TEST_EMAIL = "a3fix-1795593936194@example.com";
const TEST_PASSWORD = "Passw0rd!a3fix1";
const BOARD_NAME = "A3 fix board";

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(OUTPUT_DIR, `${name}.png`),
    fullPage: false,
  });
}

test.describe("B1 — board name visible on kanban cards", () => {
  test.setTimeout(60_000);

  test("board name on cards, modal, drag, and My Tasks", async ({ page }) => {
    // ── Step 1: Log in ──────────────────────────────────────────────────────
    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(TEST_EMAIL, TEST_PASSWORD);
    await expect(page).toHaveURL("/", { timeout: 15_000 });
    await screenshot(page, "01-logged-in");

    // ── Step 2: Open the board ───────────────────────────────────────────────
    const boardLink = page.getByRole("link", { name: BOARD_NAME });
    await expect(boardLink).toBeVisible({ timeout: 10_000 });
    await boardLink.click();
    await expect(page).toHaveURL(/\/boards\/[0-9a-f-]+$/, { timeout: 10_000 });
    await screenshot(page, "02-board-opened");

    // ── Step 3: Assert board name shown on at least one card ─────────────────
    // BoardCard renders: <span aria-label="Board: <name>">...</span>
    const boardNameOnCard = page.locator(`[aria-label="Board: ${BOARD_NAME}"]`).first();
    await expect(boardNameOnCard).toBeVisible({ timeout: 10_000 });
    await screenshot(page, "03-board-name-on-card");

    // ── Step 4: Click a card → CardDetailModal opens ─────────────────────────
    // Find the card button for a card in this board
    const cardButton = page
      .getByRole("button", { name: /^Open card: / })
      .first();
    const cardAriaLabel = await cardButton.getAttribute("aria-label") ?? "";
    const cardTitle = cardAriaLabel.replace("Open card: ", "");

    await cardButton.click();
    await expect(page.getByRole("dialog", { name: cardTitle })).toBeVisible({
      timeout: 10_000,
    });
    await screenshot(page, "04-modal-opened");

    // ── Step 5: Close modal → board name still visible on card ───────────────
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 5_000 });
    await expect(page.locator(`[aria-label="Board: ${BOARD_NAME}"]`).first()).toBeVisible({
      timeout: 5_000,
    });
    await screenshot(page, "05-modal-closed-board-name-visible");

    // ── Step 6: Drag a card from one column position to another ──────────────
    // Find first draggable card li and a sibling column to drop onto
    const draggableLis = page.locator('li[draggable="true"]');
    const liCount = await draggableLis.count();

    if (liCount >= 2) {
      // Drag card from first position to second (within or across columns)
      const sourceCard = draggableLis.nth(0);
      const targetCard = draggableLis.nth(1);

      const sourceBBox = await sourceCard.boundingBox();
      const targetBBox = await targetCard.boundingBox();

      if (sourceBBox && targetBBox) {
        // HTML5 drag via dispatchEvent
        await page.evaluate(
          ([srcSel, tgtSel]) => {
            const src = document.querySelectorAll('li[draggable="true"]')[srcSel as number];
            const tgt = document.querySelectorAll('li[draggable="true"]')[tgtSel as number];
            if (!src || !tgt) return;

            const dt = new DataTransfer();
            src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
            tgt.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
            tgt.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
            src.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
          },
          [0, 1],
        );

        // Brief pause to let React reconcile
        await page.waitForTimeout(1000);
      }
    } else if (liCount === 1) {
      // Only one card: drag it to a column drop zone instead
      const sourceCard = draggableLis.nth(0);
      const columns = page.locator('section[role="listitem"]');
      const colCount = await columns.count();
      if (colCount >= 2) {
        const targetCol = columns.nth(1);
        await sourceCard.dragTo(targetCol);
        await page.waitForTimeout(1000);
      }
    }

    // After drag, board name should still appear on cards
    const boardNameAfterDrag = page.locator(`[aria-label="Board: ${BOARD_NAME}"]`).first();
    await expect(boardNameAfterDrag).toBeVisible({ timeout: 10_000 });
    await screenshot(page, "06-board-name-after-drag");

    // ── My Tasks check ────────────────────────────────────────────────────────
    // The in-memory token is lost on a full navigation, so navigate via link.
    // Click the "My Tasks" link in the sidebar/nav if available, else go via URL
    // and re-authenticate.
    const myTasksLink = page.getByRole("link", { name: /my tasks/i }).first();
    const myTasksLinkVisible = await myTasksLink.isVisible().catch(() => false);

    if (myTasksLinkVisible) {
      await myTasksLink.click();
    } else {
      await page.goto("/my-tasks");
    }

    // If redirected to login (token lost), sign in again
    await page.waitForURL((url) => url.pathname === "/my-tasks" || url.pathname === "/login", {
      timeout: 10_000,
    });
    if (page.url().includes("/login")) {
      await login.signIn(TEST_EMAIL, TEST_PASSWORD);
      // After re-login we should be redirected to /my-tasks or /
      await page.waitForURL((url) => url.pathname !== "/login", { timeout: 10_000 });
      if (!page.url().includes("/my-tasks")) {
        const myTasksLink2 = page.getByRole("link", { name: /my tasks/i }).first();
        await myTasksLink2.click();
        await expect(page).toHaveURL(/\/my-tasks/, { timeout: 10_000 });
      }
    }

    // Wait for the list to load — the section is grouped by board name
    const boardSection = page.getByRole("region", { name: BOARD_NAME });
    await expect(boardSection).toBeVisible({ timeout: 15_000 });
    await screenshot(page, "07-my-tasks-board-name");
  });
});
