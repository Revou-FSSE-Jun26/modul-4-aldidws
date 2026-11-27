import { render, screen } from "@testing-library/react";
import { DueDateBadge } from "@/components/board/DueDateBadge";

const NOW = new Date("2026-06-15T12:00:00Z");

function badgeFor(dueDate: string | null) {
  const { container } = render(<DueDateBadge dueDate={dueDate} now={NOW} />);
  return container;
}

describe("DueDateBadge", () => {
  it("renders nothing without a due date", () => {
    expect(badgeFor(null)).toBeEmptyDOMElement();
  });

  it("shows Overdue with an icon for a past date", () => {
    const container = badgeFor("2026-06-14T12:00:00Z");
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows Due soon with an icon within 24 hours", () => {
    const container = badgeFor("2026-06-16T11:00:00Z");
    expect(screen.getByText("Due soon")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("shows the formatted date for an upcoming date and a title with the full value", () => {
    const container = badgeFor("2026-07-20T09:30:00Z");
    const badge = container.querySelector("span") as HTMLElement;
    expect(badge.textContent).toMatch(/^Due .*2026/);
    expect(badge).toHaveAttribute("title");
    expect(badge.getAttribute("title")).toMatch(/2026/);
  });

  it("uses a different style for each of the three states", () => {
    const overdue = badgeFor("2026-06-14T12:00:00Z").querySelector("span")!.className;
    document.body.innerHTML = "";
    const soon = badgeFor("2026-06-16T11:00:00Z").querySelector("span")!.className;
    document.body.innerHTML = "";
    const upcoming = badgeFor("2026-07-20T09:30:00Z").querySelector("span")!.className;
    expect(new Set([overdue, soon, upcoming]).size).toBe(3);
  });
});
