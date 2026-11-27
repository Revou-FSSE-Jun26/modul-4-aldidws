/**
 * Tests for the view-switcher added in C3.
 *
 * We test BoardDetailView (for the switcher buttons) and BoardListView (for
 * list rendering). To keep the mount fast we mock out services that make real
 * network calls and mock hooks that require the full Next.js runtime.
 */
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardDetailView } from "@/components/board/BoardDetailView";
import { jsonResponse, routeFetch } from "@/tests/fetchRoutes";
import { useAuth } from "@/context/AuthContext";

// ---- Next.js mocks ----
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  usePathname: () => "/boards/b-1",
  useSearchParams: () => new URLSearchParams(),
}));

// ---- Auth ----
jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));

// ---- Suppress react-hot-toast in tests ----
jest.mock("react-hot-toast", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
  Toaster: () => null,
}));

// ---- Hook to skip the timer-based URL debounce ----
jest.mock("@/hooks/useNow", () => ({
  useNow: () => new Date("2026-01-01T00:00:00Z"),
}));

// ---- fetchMock global ----
const fetchMock = jest.fn();
const stamp = "2026-01-01T00:00:00Z";

function card(
  id: string,
  columnId: string,
  title: string,
  priority: "low" | "medium" | "high" | null = null,
  dueDate: string | null = null,
  labels: { id: string; name: string; color: "red" }[] = [],
) {
  return {
    id,
    column_id: columnId,
    owner_id: "u-1",
    title,
    description: null,
    order: 1,
    due_date: dueDate,
    priority,
    labels,
    deleted_at: null,
    created_at: stamp,
    updated_at: stamp,
  };
}

function column(id: string, name: string, position: number, cards: ReturnType<typeof card>[]) {
  return {
    id,
    board_id: "b-1",
    name,
    position,
    color: null,
    is_done: false,
    created_at: stamp,
    updated_at: stamp,
    cards,
  };
}

function boardResponse(cols: ReturnType<typeof column>[]) {
  return jsonResponse(200, {
    data: {
      id: "b-1",
      name: "My Board",
      user_id: "u-1",
      created_at: stamp,
      updated_at: stamp,
      columns: cols,
      labels: [],
    },
  });
}

const BOARD_URL = "GET /api/boards/b-1";

describe("View switcher in BoardDetailView", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    (useAuth as jest.Mock).mockReturnValue({ token: "tok", isLoading: false });
  });

  it("renders Kanban and List buttons with aria-pressed, default kanban is pressed", async () => {
    routeFetch(fetchMock, {
      [BOARD_URL]: boardResponse([]),
    });
    render(<BoardDetailView boardId="b-1" />);

    // Wait for board to load
    await screen.findByRole("heading", { name: "My Board" });

    const kanbanBtn = screen.getByRole("button", { name: "Kanban" });
    const listBtn = screen.getByRole("button", { name: "List" });

    expect(kanbanBtn).toHaveAttribute("aria-pressed", "true");
    expect(listBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking List switches aria-pressed and shows the table", async () => {
    routeFetch(fetchMock, {
      [BOARD_URL]: boardResponse([
        column("col-1", "To Do", 0, [card("c-1", "col-1", "My task")]),
      ]),
    });
    render(<BoardDetailView boardId="b-1" />);

    await screen.findByRole("heading", { name: "My Board" });

    await userEvent.click(screen.getByRole("button", { name: "List" }));

    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Kanban" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("table", { name: "Task list" })).toBeInTheDocument();
    expect(screen.getByText("My task")).toBeInTheDocument();
  });

  it("list view rows show card title, column name, priority, due date, and labels", async () => {
    routeFetch(fetchMock, {
      [BOARD_URL]: boardResponse([
        column("col-1", "In Progress", 0, [
          card(
            "c-2",
            "col-1",
            "Special task",
            "high",
            "2026-11-05T00:00:00Z",
            [{ id: "l-1", name: "Bug", color: "red" }],
          ),
        ]),
      ]),
    });
    render(<BoardDetailView boardId="b-1" />);

    await screen.findByRole("heading", { name: "My Board" });
    await userEvent.click(screen.getByRole("button", { name: "List" }));

    expect(screen.getByText("Special task")).toBeInTheDocument();
    // Column name
    const colCell = screen.getByRole("cell", { name: "In Progress" });
    expect(colCell).toHaveAttribute("data-column-name", "In Progress");
    // Priority (span with data-priority, not the FilterBar <option>)
    const highSpan = document.querySelector('[data-priority="high"]');
    expect(highSpan).not.toBeNull();
    expect(highSpan?.textContent).toBe("High");
    // Due date
    expect(screen.getByText("Nov 5, 2026")).toBeInTheDocument();
    // Label
    expect(screen.getByText("Bug")).toBeInTheDocument();
  });

  it("clicking a list row opens the CardDetailModal", async () => {
    routeFetch(fetchMock, {
      [BOARD_URL]: boardResponse([
        column("col-1", "To Do", 0, [card("c-1", "col-1", "Open me")]),
      ]),
    });

    // Mock CardDetailModal-related services to avoid extra fetch mocks
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/boards/b-1")) {
        return jsonResponse(200, {
          data: {
            id: "b-1",
            name: "My Board",
            user_id: "u-1",
            created_at: stamp,
            updated_at: stamp,
            columns: [column("col-1", "To Do", 0, [card("c-1", "col-1", "Open me")])],
            labels: [],
          },
        });
      }
      if (String(url).includes("/comments")) {
        return jsonResponse(200, { data: [] });
      }
      throw new Error(`Unmocked: ${url}`);
    });

    render(<BoardDetailView boardId="b-1" />);
    await screen.findByRole("heading", { name: "My Board" });

    await userEvent.click(screen.getByRole("button", { name: "List" }));
    await userEvent.click(screen.getByRole("button", { name: "Open card: Open me" }));

    // CardDetailModal opens with the card title as dialog title (via BaseModal)
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("empty list shows 'No tasks'", async () => {
    routeFetch(fetchMock, {
      [BOARD_URL]: boardResponse([
        column("col-1", "To Do", 0, []),
      ]),
    });
    render(<BoardDetailView boardId="b-1" />);
    await screen.findByRole("heading", { name: "My Board" });

    await userEvent.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByText("No tasks")).toBeInTheDocument();
  });

  it("filters apply in list view — only matching cards shown", async () => {
    routeFetch(fetchMock, {
      [BOARD_URL]: boardResponse([
        column("col-1", "To Do", 0, [
          card("c-1", "col-1", "Alpha card"),
          card("c-2", "col-1", "Beta card"),
        ]),
      ]),
    });
    render(<BoardDetailView boardId="b-1" />);
    await screen.findByRole("heading", { name: "My Board" });

    // Type a keyword that only matches one card
    // FilterBar's keyword input is visible in md+ breakpoints; we show it via panel
    // We trigger it by typing in the search input (the panel is visible via CSS on md)
    const searchInput = screen.getByPlaceholderText(/Title or description/i);
    await userEvent.type(searchInput, "Alpha");

    await userEvent.click(screen.getByRole("button", { name: "List" }));

    // Allow debounce to settle
    await waitFor(() => {
      expect(screen.queryByText("Beta card")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Alpha card")).toBeInTheDocument();
  });
});
