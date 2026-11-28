import { test, expect } from "../fixtures/auth.fixture";
import { seedBoard, seedLabel, uniqueName } from "../fixtures/test-data.fixture";
import { BoardPage } from "../pages/BoardPage";
import { FilterBar } from "../pages/FilterBar";
import { LoginPage } from "../pages/LoginPage";

async function seedFilterBoard(
  request: import("@playwright/test").APIRequestContext,
  account: import("../fixtures/test-data.fixture").Account,
) {
  const run = uniqueName("Filter");
  const titles = {
    bug: `Fix login ${run}`,
    other: `Write docs ${run}`,
    done: `Ship release ${run}`,
  };
  const labelName = uniqueName("Bug");
  const seeded = await seedBoard(request, account, {
    name: run,
    columns: ["To do", "Done"],
    cards: { "To do": [titles.bug, titles.other], Done: [titles.done] },
  });
  await seedLabel(request, seeded, { name: labelName, color: "red" }, [titles.bug]);
  return { seeded, titles, labelName, run };
}

async function openBoard(
  page: import("@playwright/test").Page,
  boardId: string,
  account: import("../fixtures/test-data.fixture").Account,
  query = "",
) {
  const login = new LoginPage(page);
  await login.goto("/login?next=" + encodeURIComponent(`/boards/${boardId}${query}`));
  await login.signIn(account.email, account.password);
  // Wait for the board column list specifically (aria-label ends with "column" or "columns").
  await expect(page.getByRole("list", { name: /column/ })).toBeVisible();
  return { login, board: new BoardPage(page), filter: new FilterBar(page) };
}

test("filtering by keyword and label shows only matching cards and Clear restores them", async ({
  page,
  request,
  account,
}) => {
  const { seeded, titles, labelName } = await seedFilterBoard(request, account);
  const { board, filter } = await openBoard(page, seeded.id, account);
  await expect(board.card(titles.bug)).toBeVisible();
  await filter.openIfCollapsed();

  await filter.filterByKeyword("Fix login");
  await expect(board.card(titles.other)).toHaveCount(0);
  await expect(board.card(titles.done)).toHaveCount(0);
  await expect(board.card(titles.bug)).toBeVisible();
  await expect(filter.columnCount("To do", "1 of 2")).toBeVisible();
  await expect(filter.columnCount("Done", "0 of 1")).toBeVisible();
  await expect(filter.shown("1 of 3 cards shown")).toBeVisible();
  await expect(page).toHaveURL(/q=Fix\+login|q=Fix%20login/);

  await filter.clearButton.click();
  await expect(board.card(titles.other)).toBeVisible();
  await expect(board.card(titles.done)).toBeVisible();
  await expect(filter.keyword).toHaveValue("");

  await filter.chooseLabel(labelName);
  await expect(board.card(titles.bug)).toBeVisible();
  await expect(board.card(titles.other)).toHaveCount(0);
  await expect(filter.shown("1 of 3 cards shown")).toBeVisible();

  await filter.clearButton.click();
  await expect(board.card(titles.other)).toBeVisible();
  await expect(board.card(titles.done)).toBeVisible();
});

test("a keyword with no match shows one empty status message", async ({ page, request, account }) => {
  const { seeded, titles } = await seedFilterBoard(request, account);
  const { board, filter } = await openBoard(page, seeded.id, account);
  await expect(board.card(titles.bug)).toBeVisible();
  await filter.openIfCollapsed();

  await filter.filterByKeyword(`zzz-${uniqueName("none")}`);
  await expect(filter.noMatch).toHaveCount(1);
  await expect(board.card(titles.bug)).toHaveCount(0);
});

test("filters in the URL are applied when the board opens and typing updates the URL", async ({
  page,
  request,
  account,
}) => {
  const { seeded, titles } = await seedFilterBoard(request, account);
  // A link with ?q= is followed through the login page (the token is memory only).
  const { board, filter } = await openBoard(page, seeded.id, account, "?q=Write%20docs");
  await expect(board.card(titles.other)).toBeVisible();
  await expect(board.card(titles.bug)).toHaveCount(0);
  await expect(board.card(titles.done)).toHaveCount(0);
  await filter.openIfCollapsed();
  await expect(filter.keyword).toHaveValue("Write docs");
  await expect(filter.shown("1 of 3 cards shown")).toBeVisible();

  await filter.filterByKeyword("Ship release");
  await expect(page).toHaveURL(/q=Ship/);
  await expect(board.card(titles.done)).toBeVisible();
  await expect(board.card(titles.other)).toHaveCount(0);
});
