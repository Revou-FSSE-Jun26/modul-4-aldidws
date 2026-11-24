import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/auth.fixture";
import { seedBoard, uniqueName } from "../fixtures/test-data.fixture";
import { BoardPage } from "../pages/BoardPage";
import { CardModal } from "../pages/CardModal";
import { DashboardPage } from "../pages/DashboardPage";
import { Header } from "../pages/Header";
import { LoginPage } from "../pages/LoginPage";

/** Runs in the "mobile" project (375 x 812). */
async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

test("dashboard, board and card modal fit a 375px screen", async ({ page, request, account }) => {
  const card = "Mobile card with a fairly long title to test wrapping";
  const seeded = await seedBoard(request, account, {
    name: uniqueName("Mobile board with a long name"),
    columns: ["To do", "In progress", "Done"],
    cards: { "To do": [card] },
  });

  const login = new LoginPage(page);
  await login.goto();
  await login.signIn(account.email, account.password);

  const dashboard = new DashboardPage(page);
  await expect(dashboard.boardLink(seeded.name)).toBeVisible();
  expect(page.viewportSize()?.width).toBe(375);
  await expectNoHorizontalOverflow(page);

  const header = new Header(page);
  await header.openMenuIfCollapsed();
  await expect(header.nav.getByRole("link", { name: "My Tasks" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await dashboard.openBoard(seeded.name);
  const board = new BoardPage(page);
  await expect(board.cardIn("To do", card)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await board.openCard(card);
  await expect(new CardModal(page, card).dialog).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
