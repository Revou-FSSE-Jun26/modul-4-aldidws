import { expect, type Locator, type Page } from "@playwright/test";

/** The main header: navigation, notification bell and log out. */
export class Header {
  readonly nav: Locator;
  readonly menuButton: Locator;
  readonly bell: Locator;
  readonly logoutButton: Locator;

  constructor(private readonly page: Page) {
    this.nav = page.getByRole("navigation", { name: "Main" });
    this.menuButton = page.getByRole("button", { name: "Menu" });
    this.bell = page.getByRole("button", { name: /^Notifications/ });
    this.logoutButton = page.getByRole("button", { name: "Log out" });
  }

  /** On small screens the links sit behind a Menu button. */
  async openMenuIfCollapsed(): Promise<void> {
    if (await this.menuButton.isVisible()) {
      if ((await this.menuButton.getAttribute("aria-expanded")) !== "true") {
        await this.menuButton.click();
      }
      await expect(this.menuButton).toHaveAttribute("aria-expanded", "true");
    }
  }

  async logout(): Promise<void> {
    await this.openMenuIfCollapsed();
    await this.logoutButton.click();
  }

  /** The bell polls every 30 s, so a new comment can take that long to show up. */
  async expectUnread(count: number): Promise<void> {
    const name = count === 0 ? /none unread/ : new RegExp(`${count} unread`);
    await expect(this.bell).toHaveAccessibleName(name, { timeout: 45_000 });
  }

  /** Opens the bell panel and clicks the first notification. */
  async markFirstNotificationRead(): Promise<void> {
    await this.bell.click();
    const panel = this.page.getByRole("region", { name: "Notifications" });
    await panel.getByRole("button").first().click();
  }
}
