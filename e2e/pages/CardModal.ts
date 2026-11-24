import { expect, type Locator, type Page } from "@playwright/test";

export class CardModal {
  readonly dialog: Locator;

  constructor(
    private readonly page: Page,
    title: string,
  ) {
    this.dialog = page.getByRole("dialog", { name: title });
  }

  comment(text: string): Locator {
    return this.dialog.getByTestId("comment-item").filter({ hasText: text });
  }

  async addComment(text: string): Promise<void> {
    await this.dialog.getByLabel("Add a comment").fill(text);
    await this.dialog.getByRole("button", { name: "Post comment" }).click();
    await expect(this.comment(text)).toBeVisible();
  }

  async editComment(from: string, to: string): Promise<void> {
    await this.comment(from).getByRole("button", { name: "Edit comment" }).click();
    await this.dialog.getByLabel("Edit comment text").fill(to);
    await this.dialog.getByRole("button", { name: "Save comment" }).click();
    await expect(this.comment(to)).toBeVisible();
  }

  async deleteComment(text: string): Promise<void> {
    await this.comment(text).getByRole("button", { name: "Delete comment" }).click();
    await expect(this.comment(text)).toHaveCount(0);
  }

  async saveTitle(title: string): Promise<void> {
    await this.dialog.getByLabel("Card title").fill(title);
    await this.dialog.getByRole("button", { name: "Save changes" }).click();
  }

  async moveTo(column: string): Promise<void> {
    await this.dialog.getByLabel("Move to column").selectOption({ label: column });
  }

  async deleteCard(): Promise<void> {
    await this.dialog.getByRole("button", { name: "Delete card" }).click();
    await this.page.getByRole("button", { name: "Confirm delete" }).click();
  }

  async close(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await expect(this.dialog).toBeHidden();
  }
}
