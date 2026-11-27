import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/auth.fixture";
import { seedBoard, seedLabel, uniqueName } from "../fixtures/test-data.fixture";
import { BoardPage } from "../pages/BoardPage";
import { CardModal } from "../pages/CardModal";
import { DashboardPage } from "../pages/DashboardPage";
import { FilterBar } from "../pages/FilterBar";
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

test("the open filter bar fits a 375px screen and filters cards", async ({
  page,
  request,
  account,
}) => {
  const match = uniqueName("Mobile match");
  const other = uniqueName("Mobile other");
  const seeded = await seedBoard(request, account, {
    name: uniqueName("Mobile filter"),
    columns: ["To do"],
    cards: { "To do": [match, other] },
  });
  const labelName = uniqueName("Bug");
  await seedLabel(request, seeded, { name: labelName, color: "red" }, [match]);

  const login = new LoginPage(page);
  await login.goto("/login?next=" + encodeURIComponent(`/boards/${seeded.id}`));
  await login.signIn(account.email, account.password);
  const board = new BoardPage(page);
  await expect(board.cardIn("To do", match)).toBeVisible();

  const filter = new FilterBar(page);
  await expect(filter.toggle).toHaveAttribute("aria-expanded", "false");
  await filter.openIfCollapsed();
  await expect(filter.toggle).toHaveAttribute("aria-expanded", "true");
  await expectNoHorizontalOverflow(page);

  await filter.chooseLabel(labelName);
  await expect(board.card(other)).toHaveCount(0);
  await expect(board.card(match)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
