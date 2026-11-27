import { expect, type Locator, type Page } from "@playwright/test";

/** The board filter bar (keyword, labels, due date, clear). */
export class FilterBar {
  readonly region: Locator;
  readonly keyword: Locator;
  readonly labelsButton: Locator;
  readonly due: Locator;
  readonly clearButton: Locator;
  readonly toggle: Locator;
  readonly noMatch: Locator;

  constructor(private readonly page: Page) {
    this.region = page.getByRole("region", { name: "Filter cards" });
    this.keyword = this.region.getByLabel("Filter cards");
    this.labelsButton = this.region.getByRole("button", { name: /^(Any label|Labels \()/ });
    this.due = this.region.getByLabel("Due date");
    this.clearButton = this.region.getByRole("button", { name: "Clear filters" });
    this.toggle = this.region.getByRole("button", { name: /^Filters/ });
    this.noMatch = page.getByRole("status").filter({ hasText: "No cards match these filters." });
  }

  /** Expands the bar when it is collapsed (below the md breakpoint). */
  async openIfCollapsed(): Promise<void> {
    if (await this.toggle.isVisible()) {
      if ((await this.toggle.getAttribute("aria-expanded")) !== "true") await this.toggle.click();
    }
    await expect(this.keyword).toBeVisible();
  }

  async filterByKeyword(text: string): Promise<void> {
    await this.keyword.fill(text);
  }

  async chooseLabel(name: string): Promise<void> {
    await this.labelsButton.click();
    await this.region.getByRole("option").filter({ hasText: name }).click();
    await this.region.getByRole("button", { name: "Close", exact: true }).click();
  }

  /** The polite status text, e.g. "1 of 3 cards shown". */
  shown(text: string): Locator {
    return this.region.getByText(text, { exact: true });
  }

  /** Column header count text, e.g. "1 of 2". */
  columnCount(column: string, text: string): Locator {
    return this.page.getByRole("listitem", { name: column, exact: true }).getByText(text, { exact: true });
  }
}
