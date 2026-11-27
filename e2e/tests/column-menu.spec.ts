import { test, expect } from "../fixtures/auth.fixture";
import { seedBoard, uniqueName } from "../fixtures/test-data.fixture";
import { BoardPage } from "../pages/BoardPage";
import { LoginPage } from "../pages/LoginPage";

/**
 * Regression: on a short (empty) column the "..." menu used to be clipped by the
 * board's horizontally scrolling column list, so the lower items could not be
 * clicked with the mouse. Clicks go through page.mouse at the item's position
 * (no locator auto-scroll), the way a user clicks.
 */
test("column menu items on a short column work with the mouse and persist", async ({
  page,
  request,
  account,
}) => {
  const seeded = await seedBoard(request, account, {
    name: uniqueName("Menu"),
    columns: ["To do", "Done"],
  });
  const login = new LoginPage(page);
  const next = "/login?next=" + encodeURIComponent(`/boards/${seeded.id}`);
  await login.goto(next);
  await login.signIn(account.email, account.password);
  const board = new BoardPage(page);
  const header = board.column("To do").locator("header");
  const trigger = board.column("To do").getByRole("button", { name: "Column actions for To do" });
  const menu = page.getByRole("menu", { name: "Column actions for To do" });

  async function mouseClick(name: string, role: "menuitem" | "menuitemradio") {
    await trigger.click();
    const item = menu.getByRole(role, { name });
    const box = await item.boundingBox();
    if (!box) throw new Error(`${name} has no box`);
    // The item must be the element under the pointer, not clipped away.
    const hit = await item.evaluate((el, p) => document.elementFromPoint(p.x, p.y) === el, {
      x: box.x + 8,
      y: box.y + box.height / 2,
    });
    expect(hit).toBe(true);
    await page.mouse.click(box.x + 8, box.y + box.height / 2);
  }

  await mouseClick("Red", "menuitemradio");
  await expect(header).toHaveAttribute("data-status", "red");
  await mouseClick("Mark as Done column", "menuitem");
  await expect(header).toHaveAttribute("data-done", "true");

  await login.goto(next);
  await login.signIn(account.email, account.password);
  await expect(header).toHaveAttribute("data-status", "red");
  await expect(header).toHaveAttribute("data-done", "true");
  await trigger.click();
  await expect(menu.getByRole("menuitem", { name: "Unmark Done column" })).toBeVisible();
});
