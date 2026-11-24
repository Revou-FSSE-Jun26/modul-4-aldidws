import { expect, type Locator, type Page } from "@playwright/test";

export class BoardPage {
  readonly search: Locator;
  readonly searchResults: Locator;

  constructor(private readonly page: Page) {
    this.search = page.getByLabel("Search cards");
    this.searchResults = page.getByRole("list", { name: "Search results" });
  }

  async goto(boardId: string): Promise<void> {
    await this.page.goto(`/boards/${boardId}`);
  }

  heading(name: string): Locator {
    return this.page.getByRole("heading", { name });
  }

  /** A column is a list item named by the column name. */
  column(name: string): Locator {
    return this.page.getByRole("listitem", { name, exact: true });
  }

  /** The open-card button for a card title, anywhere on the board. */
  card(title: string): Locator {
    return this.page.getByRole("button", { name: `Open card: ${title}`, exact: true });
  }

  cardIn(column: string, title: string): Locator {
    return this.column(column).getByRole("button", { name: `Open card: ${title}`, exact: true });
  }

  async addColumn(name: string): Promise<void> {
    await this.page.getByRole("button", { name: "Add column" }).click();
    await this.page.getByLabel("Column name").fill(name);
    await this.page.getByRole("button", { name: "Create column" }).click();
    await expect(this.column(name)).toBeVisible();
  }

  async renameColumn(from: string, to: string): Promise<void> {
    await this.page.getByRole("button", { name: `Rename column: ${from}` }).click();
    const input = this.column(from).getByRole("textbox");
    await input.fill(to);
    await input.press("Enter");
  }

  async deleteColumn(name: string): Promise<void> {
    await this.page.getByRole("button", { name: `Delete column: ${name}` }).click();
    await this.page.getByRole("button", { name: "Confirm delete" }).click();
  }

  async addCard(column: string, title: string): Promise<void> {
    await this.page.getByRole("button", { name: `Add card to ${column}` }).click();
    await this.column(column).getByLabel("Card title").fill(title);
    await this.column(column).getByRole("button", { name: "Save card" }).click();
    await expect(this.cardIn(column, title)).toBeVisible();
  }

  async openCard(title: string): Promise<void> {
    await this.card(title).click();
    await expect(this.page.getByRole("dialog", { name: title })).toBeVisible();
  }

  /** Native HTML5 drag of a card onto a column. */
  async dragCardToColumn(title: string, column: string): Promise<void> {
    const source = this.page.locator('li[draggable="true"]').filter({ has: this.card(title) });
    await source.dragTo(this.column(column));
  }

  async searchFor(text: string): Promise<void> {
    await this.search.fill(text);
  }
}
