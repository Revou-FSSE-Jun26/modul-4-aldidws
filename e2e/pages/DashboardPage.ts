import { expect, type Locator, type Page } from "@playwright/test";

export class DashboardPage {
  readonly createBoardButton: Locator;
  readonly boardNameInput: Locator;
  readonly submitBoard: Locator;
  readonly formError: Locator;

  constructor(private readonly page: Page) {
    this.createBoardButton = page.getByRole("button", { name: "Create board" });
    this.boardNameInput = page.getByLabel("Board name");
    this.submitBoard = page.getByRole("button", { name: "Create", exact: true });
    // Scoped to the form: Next.js adds its own route-announcer alert to every page.
    this.formError = page.locator("form").getByRole("alert");
  }

  async goto(): Promise<void> {
    await this.page.goto("/");
  }

  boardLink(name: string): Locator {
    return this.page.getByRole("link", { name });
  }

  async createBoard(name: string): Promise<void> {
    await this.createBoardButton.click();
    await this.boardNameInput.fill(name);
    await this.submitBoard.click();
  }

  async openBoard(name: string): Promise<void> {
    await this.boardLink(name).click();
    await expect(this.page.getByRole("heading", { name })).toBeVisible();
  }
}
