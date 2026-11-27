import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterBar, type FilterBarProps } from "@/components/board/FilterBar";
import { EMPTY_FILTERS } from "@/lib/filterCards";
import type { Label } from "@/lib/types/api";
import type { SortBy } from "@/lib/sortCards";

const stamp = "2026-01-01T00:00:00Z";
const labels: Label[] = [
  { id: "l-1", board_id: "b-1", name: "Bug", color: "red", created_at: stamp, updated_at: stamp },
  { id: "l-2", board_id: "b-1", name: "Docs", color: "blue", created_at: stamp, updated_at: stamp },
] as Label[];

function setup(overrides: Partial<FilterBarProps> = {}) {
  const props: FilterBarProps = {
    labels,
    filters: EMPTY_FILTERS,
    activeCount: 0,
    status: null,
    open: false,
    onOpenChange: jest.fn(),
    focusSignal: 0,
    onKeywordChange: jest.fn(),
    onLabelIdsChange: jest.fn(),
    onDueChange: jest.fn(),
    onPriorityChange: jest.fn(),
    sort: "manual" as const,
    onSortChange: jest.fn(),
    groupBy: "none",
    onGroupByChange: jest.fn(),
    onClear: jest.fn(),
    ...overrides,
  };
  render(<FilterBar {...props} />);
  return props;
}

describe("FilterBar", () => {
  it("has labelled controls and the shortcut hint", () => {
    setup();
    const input = screen.getByRole("searchbox", { name: "Filter cards" });
    expect(input).toHaveAttribute("aria-keyshortcuts", "f");
    expect(screen.getByLabelText("Due date")).toBeInTheDocument();
    expect(screen.getByLabelText("Priority")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Any label" })).toBeInTheDocument();
  });

  it("offers the six due options including 'Due today'", () => {
    setup();
    // The due date select options (not priority options which share the page)
    const dueSelect = screen.getByLabelText("Due date");
    const options = Array.from(dueSelect.querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toEqual([
      "Any due date",
      "Overdue cards",
      "Due today",
      "Due in the next 24 hours",
      "Due in the next 7 days",
      "No due date",
    ]);
  });

  it("reports keyword, due and priority changes", async () => {
    const props = setup();
    await userEvent.type(screen.getByRole("searchbox", { name: "Filter cards" }), "a");
    expect(props.onKeywordChange).toHaveBeenCalledWith("a");
    await userEvent.selectOptions(screen.getByLabelText("Due date"), "7d");
    expect(props.onDueChange).toHaveBeenCalledWith("7d");
    await userEvent.selectOptions(screen.getByLabelText("Due date"), "today");
    expect(props.onDueChange).toHaveBeenCalledWith("today");
    await userEvent.selectOptions(screen.getByLabelText("Priority"), "high");
    expect(props.onPriorityChange).toHaveBeenCalledWith("high");
  });

  it("toggles labels in the listbox with the mouse and the keyboard", async () => {
    const props = setup({ filters: { ...EMPTY_FILTERS, labelIds: ["l-2"] }, activeCount: 1 });
    await userEvent.click(screen.getByRole("button", { name: "Labels (1 selected)" }));
    const list = screen.getByRole("listbox", { name: "Cards with any of these labels" });
    expect(list).toHaveFocus();
    expect(screen.getByRole("option", { name: /Docs/ })).toHaveAttribute("aria-selected", "true");

    await userEvent.click(screen.getByRole("option", { name: /Bug/ }));
    expect(props.onLabelIdsChange).toHaveBeenLastCalledWith(["l-2", "l-1"]);

    await userEvent.click(list);
    await userEvent.keyboard("{Home}{ }");
    expect(props.onLabelIdsChange).toHaveBeenLastCalledWith(["l-2", "l-1"]);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(props.onLabelIdsChange).toHaveBeenLastCalledWith([]);
  });

  it("closes the listbox with Escape and returns focus to its button", async () => {
    setup();
    const button = screen.getByRole("button", { name: "Any label" });
    await userEvent.click(button);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("calls onClear from Clear all when filters are active", async () => {
    const props = setup({ activeCount: 2, filters: { ...EMPTY_FILTERS, keyword: "a" } });
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it("disables Clear all when no filter is active", () => {
    setup();
    expect(screen.getByRole("button", { name: "Clear all" })).toBeDisabled();
  });

  it("shows the drag notice only while a filter is active", () => {
    setup({ activeCount: 1 });
    expect(screen.getByText(/dragging is turned off/i)).toBeInTheDocument();
  });

  it("does not show the drag notice without filters", () => {
    setup();
    expect(screen.queryByText(/dragging is turned off/i)).not.toBeInTheDocument();
  });

  it("shows the status text from the given counts", () => {
    setup({ activeCount: 1, status: { shown: 2, total: 9 } });
    expect(screen.getByText("2 of 9 cards shown")).toBeInTheDocument();
  });

  it("has an expandable Filters button with the active count for small screens", async () => {
    const props = setup({ activeCount: 2, open: false });
    const toggle = screen.getByRole("button", { name: "Filters (2 active)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const controls = toggle.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls as string)).toHaveClass("hidden");
    await userEvent.click(toggle);
    expect(props.onOpenChange).toHaveBeenCalledWith(true);
  });

  it("marks the panel visible when open", () => {
    setup({ open: true });
    const toggle = screen.getByRole("button", { name: "Filters" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(toggle.getAttribute("aria-controls") as string)).not.toHaveClass(
      "hidden",
    );
  });

  it("moves focus to the keyword input when the focus signal changes", () => {
    const props: FilterBarProps = {
      labels,
      filters: EMPTY_FILTERS,
      activeCount: 0,
      status: null,
      open: true,
      onOpenChange: jest.fn(),
      focusSignal: 0,
      onKeywordChange: jest.fn(),
      onLabelIdsChange: jest.fn(),
      onDueChange: jest.fn(),
      onPriorityChange: jest.fn(),
      sort: "manual" as SortBy,
      onSortChange: jest.fn(),
      groupBy: "none",
      onGroupByChange: jest.fn(),
      onClear: jest.fn(),
    };
    const { rerender } = render(<FilterBar {...props} />);
    expect(screen.getByRole("searchbox", { name: "Filter cards" })).not.toHaveFocus();
    rerender(<FilterBar {...props} focusSignal={1} />);
    expect(screen.getByRole("searchbox", { name: "Filter cards" })).toHaveFocus();
  });

  it("sort select has 5 options (Manual, Due date, Priority, Created, Title)", () => {
    setup({ open: true });
    const sortSelect = screen.getByLabelText("Sort by");
    const options = Array.from(sortSelect.querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toEqual([
      "Manual",
      "Due date",
      "Priority",
      "Created (newest first)",
      "Title (A-Z)",
    ]);
  });

  it("group select has 2 options (None, Priority) and defaults to None", () => {
    setup({ open: true });
    const groupSelect = screen.getByLabelText("Group by");
    const options = Array.from(groupSelect.querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toEqual(["None", "Priority"]);
    expect(groupSelect).toHaveValue("none");
  });

  it("selecting 'priority' calls onGroupByChange with 'priority'", async () => {
    const props = setup({ open: true });
    await userEvent.selectOptions(screen.getByLabelText("Group by"), "priority");
    expect(props.onGroupByChange).toHaveBeenCalledWith("priority");
  });

  it("selecting 'due' calls onSortChange with 'due'", async () => {
    const props = setup({ open: true });
    await userEvent.selectOptions(screen.getByLabelText("Sort by"), "due");
    expect(props.onSortChange).toHaveBeenCalledWith("due");
  });

  it("drag notice shows when activeCount=0 but sort='due'", () => {
    setup({ activeCount: 0, sort: "due" as SortBy });
    expect(screen.getByText(/dragging is turned off/i)).toBeInTheDocument();
  });

  it("drag notice shows when activeCount=1 regardless of sort", () => {
    setup({ activeCount: 1, sort: "manual" as SortBy });
    expect(screen.getByText(/dragging is turned off/i)).toBeInTheDocument();
  });
});
