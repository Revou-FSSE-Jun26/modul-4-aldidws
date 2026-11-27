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

  get dueDateInput(): Locator {
    return this.dialog.getByLabel("Due date");
  }
  /** `localValue` is a datetime-local string such as "2031-07-15T10:30" (browser local time). */
  async setDueDate(localValue: string): Promise<void> {
    await this.dueDateInput.fill(localValue);
    await this.dialog.getByRole("button", { name: "Save due date" }).click();
    // After a successful save the field is unchanged, so Save is disabled again.
    await expect(this.dialog.getByRole("button", { name: "Save due date" })).toBeDisabled();
    await expect(this.dialog.getByRole("button", { name: "Remove due date" })).toBeEnabled();
  }
  async removeDueDate(): Promise<void> {
    await this.dialog.getByRole("button", { name: "Remove due date" }).click();
    await expect(this.dialog.getByRole("button", { name: "Remove due date" })).toBeDisabled();
    await expect(this.dueDateInput).toHaveValue("");
  }
  /** Creates a board label in the "Board labels" section and waits until it is listed. */
  async createLabel(name: string, colorName: string): Promise<void> {
    await this.dialog.getByLabel("New label name").fill(name);
    await this.dialog.getByRole("radio", { name: colorName, exact: true }).first().check();
    await this.dialog.getByRole("button", { name: "Create label" }).click();
    await expect(this.dialog.getByRole("button", { name: `Edit label ${name}` })).toBeVisible();
  }

  async openLabelPicker(): Promise<Locator> {
    await this.dialog.getByRole("button", { name: "Labels", exact: true }).click();
    const list = this.dialog.getByRole("listbox", { name: "Labels" });
    await expect(list).toBeVisible();
    return list;
  }

  /** Opens the picker, toggles the named labels and applies. */
  async setLabels(names: string[]): Promise<void> {
    const list = await this.openLabelPicker();
    for (const name of names) {
      await list.getByRole("option").filter({ hasText: name }).click();
    }
    await this.dialog.getByRole("button", { name: "Apply" }).click();
    await expect(this.dialog.getByRole("listbox")).toBeHidden();
  }

  async saveTitle(title: string): Promise<void> {
    await this.dialog.getByLabel("Card title").fill(title);
    await this.dialog.getByRole("button", { name: "Save changes" }).click();
  }

  /** Select a priority level or "" for no priority. Waits for the select to stabilize. */
  async setPriority(value: "" | "low" | "medium" | "high"): Promise<void> {
    await this.dialog.getByLabel("Priority").selectOption(value);
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
