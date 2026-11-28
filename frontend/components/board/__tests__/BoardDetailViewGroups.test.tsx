import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardDetailView } from "@/components/board/BoardDetailView";
import { useAuth } from "@/context/AuthContext";
import {
  showError,
  showSuccess,
  showLoading,
  dismissToast,
} from "@/lib/toast";
import { jsonResponse, routeFetch } from "@/tests/fetchRoutes";

const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  usePathname: () => "/boards/b-1",
  useSearchParams: () => new URLSearchParams(""),
}));
jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/toast", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
  showLoading: jest.fn(() => "toast-1"),
  dismissToast: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const fetchMock = jest.fn();

const stamp = "2026-01-01T00:00:00Z";

function makeCard(
  id: string,
  columnId: string,
  title: string,
  order: number,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    column_id: columnId,
    owner_id: "u-1",
    title,
    description: null,
    order,
    due_date: null,
    priority: null,
    labels: [],
    deleted_at: null,
    created_at: stamp,
    updated_at: stamp,
    ...extra,
  };
}

function makeColumn(
  id: string,
  name: string,
  position: number,
  cards: unknown[],
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    board_id: "b-1",
    name,
    position,
    created_at: stamp,
    updated_at: stamp,
    ...extra,
    cards,
  };
}

function makeBoard(columns: unknown[], labels: unknown[] = []) {
  return {
    id: "b-1",
    name: "Board One",
    user_id: "u-1",
    created_at: stamp,
    updated_at: stamp,
    columns,
    labels,
  };
}

const BOARD_GET = "GET /api/boards/b-1";

/** Board with cards at every priority level across two columns. */
function prioritisedBoard() {
  return makeBoard([
    makeColumn("c-1", "To Do", 1, [
      makeCard("h1", "c-1", "High one", 0, { priority: "high" }),
      makeCard("m1", "c-1", "Medium one", 1, { priority: "medium" }),
    ]),
    makeColumn("c-2", "Done", 2, [
      makeCard("h2", "c-2", "High two", 0, { priority: "high" }),
      makeCard("n1", "c-2", "Plain one", 1, { priority: null }),
    ]),
  ]);
}

beforeEach(() => {
  mockReplace.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  (showError as jest.Mock).mockReset();
  (showSuccess as jest.Mock).mockReset();
  (showLoading as jest.Mock).mockReset().mockReturnValue("toast-1");
  (dismissToast as jest.Mock).mockReset();
  mockUseAuth.mockReturnValue({
    token: "test-token",
    isAuthLoading: false,
    currentUser: { id: "u-1", email: "a@b.co", name: "Ann", role: "user", timezone: "UTC" },
  });
});

async function selectGroupBy(value: "none" | "priority") {
  await userEvent.selectOptions(screen.getByLabelText("Group by"), value);
}

describe("C6 — Group by priority", () => {
  it("does not render group headings by default (group by none)", async () => {
    routeFetch(fetchMock, {
      [BOARD_GET]: jsonResponse(200, { data: prioritisedBoard() }),
    });
    render(<BoardDetailView boardId="b-1" />);
    await screen.findByRole("button", { name: "Open card: High one" });
    expect(screen.queryByRole("heading", { name: "High" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Low" })).not.toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "To Do" })).toBeInTheDocument();
  });

  it("renders group sections in kanban view when grouped by priority", async () => {
    routeFetch(fetchMock, {
      [BOARD_GET]: jsonResponse(200, { data: prioritisedBoard() }),
    });
    render(<BoardDetailView boardId="b-1" />);
    await screen.findByRole("button", { name: "Open card: High one" });

    await selectGroupBy("priority");

    // Headings: High, Medium, No priority (Low has no cards anywhere → hidden)
    expect(screen.getByRole("heading", { name: "High" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Medium" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No priority" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Low" })).not.toBeInTheDocument();

    // The High group contains both columns, each with only its high cards.
    const highGroup = screen.getByRole("region", { name: "High priority group" });
    expect(
      within(highGroup).getByRole("button", { name: "Open card: High one" }),
    ).toBeInTheDocument();
    expect(
      within(highGroup).getByRole("button", { name: "Open card: High two" }),
    ).toBeInTheDocument();
    expect(
      within(highGroup).queryByRole("button", { name: "Open card: Medium one" }),
    ).not.toBeInTheDocument();
    expect(
      within(highGroup).queryByRole("button", { name: "Open card: Plain one" }),
    ).not.toBeInTheDocument();

    // Both columns appear in the High group; To Do holds the medium card so it
    // shows "No tasks" inside the High section.
    // Use data-column-id to find the actual column sections (not card li elements).
    const todoCol = highGroup.querySelector('[data-column-id="c-1"]') as HTMLElement;
    expect(todoCol).not.toBeNull();
    const doneCol = highGroup.querySelector('[data-column-id="c-2"]') as HTMLElement;
    expect(doneCol).not.toBeNull();
    // c-1 (To Do) has a high card and c-2 (Done) also has a high card.
    // In the High group both columns have cards — verify they're shown.
    expect(within(todoCol).getByRole("button", { name: "Open card: High one" })).toBeInTheDocument();
    // The Medium group's To Do column has cards but no high cards, so check Medium group for "No tasks" in Done
    const mediumGroup = screen.getByRole("region", { name: "Medium priority group" });
    const doneMedCol = mediumGroup.querySelector('[data-column-id="c-2"]') as HTMLElement;
    expect(doneMedCol).not.toBeNull();
    expect(within(doneMedCol).queryByText("No tasks")).toBeInTheDocument();
  });

  it("renders group header rows in list view when grouped by priority", async () => {
    routeFetch(fetchMock, {
      [BOARD_GET]: jsonResponse(200, { data: prioritisedBoard() }),
    });
    render(<BoardDetailView boardId="b-1" />);
    await screen.findByRole("button", { name: "Open card: High one" });

    await selectGroupBy("priority");
    await userEvent.click(screen.getByRole("button", { name: "List" }));

    expect(screen.getByRole("table", { name: "Task list" })).toBeInTheDocument();
    // All four groups are present in the list view (Low is empty).
    const headers = screen.getAllByRole("columnheader");
    const headerTexts = headers.map((h) => h.textContent);
    expect(headerTexts).toContain("High (2)");
    expect(headerTexts).toContain("Medium (1)");
    expect(headerTexts).toContain("Low (0)");
    expect(headerTexts).toContain("No priority (1)");
  });
});

describe("C7 — Export JSON", () => {
  it("triggers a download of <board-name>.json with the board data", async () => {
    const createObjectURL = jest.fn(() => "blob:mock-url");
    const revokeObjectURL = jest.fn();
    Object.defineProperty(URL, "createObjectURL", {
      value: createObjectURL,
      writable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: revokeObjectURL,
      writable: true,
    });
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    routeFetch(fetchMock, {
      [BOARD_GET]: jsonResponse(200, { data: prioritisedBoard() }),
      "GET /api/notifications": jsonResponse(200, { data: [], meta: { unread_count: 0 } }),
    });
    render(<BoardDetailView boardId="b-1" />);
    await screen.findByRole("button", { name: "Open card: High one" });

    await userEvent.click(screen.getByRole("button", { name: "Import / Export" }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

    // The blob is a JSON export of the board (read with FileReader; jsdom
    // Blob does not implement .text()).
    const blob = (createObjectURL as jest.Mock).mock.calls[0][0] as Blob;
    const blobText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
    const parsed = JSON.parse(blobText);
    expect(parsed.board.name).toBe("Board One");
    expect(parsed.board.columns).toHaveLength(2);
    expect(parsed.board.columns[0].name).toBe("To Do");

    clickSpy.mockRestore();
  });
});

describe("C7 — Import JSON", () => {
  function fireImportFile(content: string) {
    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"]',
    );
    expect(input).not.toBeNull();
    const file = new File([content], "board.json", { type: "application/json" });
    fireEvent.change(input as HTMLElement, { target: { files: [file] } });
  }

  it("shows an error toast and creates nothing for invalid JSON", async () => {
    const calls = routeFetch(fetchMock, {
      [BOARD_GET]: jsonResponse(200, { data: prioritisedBoard() }),
    });
    render(<BoardDetailView boardId="b-1" />);
    await screen.findByRole("button", { name: "Open card: High one" });

    fireImportFile("{ not json");
    await waitFor(() => expect(showError).toHaveBeenCalled());
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
    expect(showLoading).not.toHaveBeenCalled();
  });

  it("shows an error toast for structurally invalid files", async () => {
    routeFetch(fetchMock, {
      [BOARD_GET]: jsonResponse(200, { data: prioritisedBoard() }),
    });
    render(<BoardDetailView boardId="b-1" />);
    await screen.findByRole("button", { name: "Open card: High one" });

    fireImportFile(JSON.stringify({ board: { columns: [{ cards: [{ title: "X" }] }] } }));
    await waitFor(() =>
      expect(showError).toHaveBeenCalledWith(
        expect.stringContaining("each column must have a name"),
      ),
    );
    expect(showLoading).not.toHaveBeenCalled();
  });

  it("creates each column and card sequentially, then reloads the board", async () => {
    let columnPostCount = 0;
    const calls = routeFetch(fetchMock, {
      [BOARD_GET]: jsonResponse(200, { data: prioritisedBoard() }),
      "POST /api/boards/b-1/columns": () => {
        columnPostCount += 1;
        const id = `nc-${columnPostCount}`;
        return jsonResponse(201, {
          data: {
            id,
            board_id: "b-1",
            name: "Imported col",
            position: columnPostCount,
            color: null,
            is_done: false,
            created_at: stamp,
            updated_at: stamp,
          },
        });
      },
      "POST /api/v1/columns/nc-1/cards": jsonResponse(201, {
        data: makeCard("new-1", "nc-1", "Imported task", 0),
      }),
      "POST /api/v1/columns/nc-2/cards": jsonResponse(201, {
        data: makeCard("new-2", "nc-2", "Second task", 0),
      }),
    });
    render(<BoardDetailView boardId="b-1" />);
    await screen.findByRole("button", { name: "Open card: High one" });

    fireImportFile(
      JSON.stringify({
        board: {
          name: "Imported board",
          columns: [
            {
              name: "Col A",
              color: null,
              is_done: false,
              cards: [
                {
                  title: "Imported task",
                  description: "From file",
                  priority: "high",
                  due_date: "2026-12-01T17:00:00Z",
                  labels: [],
                },
              ],
            },
            {
              name: "Col B",
              cards: [{ title: "Second task", labels: [] }],
            },
          ],
        },
      }),
    );

    await waitFor(() => expect(showSuccess).toHaveBeenCalledWith("Import complete."));

    // Two columns created, one card each.
    const columnPosts = calls.filter(
      (c) => c.method === "POST" && c.path === "/api/boards/b-1/columns",
    );
    expect(columnPosts).toHaveLength(2);
    expect(columnPosts[0].body).toEqual({ name: "Col A" });
    expect(columnPosts[1].body).toEqual({ name: "Col B" });

    const cardPosts = calls.filter((c) => c.method === "POST" && c.path.endsWith("/cards"));
    expect(cardPosts).toHaveLength(2);
    expect(cardPosts[0].body).toEqual({
      title: "Imported task",
      description: "From file",
      priority: "high",
      due_date: "2026-12-01T17:00:00Z",
    });
    expect(cardPosts[1].body).toEqual({ title: "Second task" });

    // Column creation is sequential: Col A's card is created before Col B is posted.
    const order = calls.filter((c) => c.method === "POST").map((c) => c.path);
    const firstCardIdx = order.indexOf("/api/v1/columns/nc-1/cards");
    expect(firstCardIdx).toBeGreaterThan(-1);
    expect(firstCardIdx).toBeLessThan(order.lastIndexOf("/api/boards/b-1/columns"));
    expect(order.indexOf("/api/v1/columns/nc-2/cards")).toBeGreaterThan(
      order.lastIndexOf("/api/boards/b-1/columns"),
    );

    // The board is reloaded after the import (at least 2 GET calls: initial + post-import).
    const boardGets = calls.filter((c) => c.method === "GET" && c.path === "/api/boards/b-1");
    expect(boardGets.length).toBeGreaterThanOrEqual(2);
    expect(showLoading).toHaveBeenCalledWith("Importing…");
    expect(dismissToast).toHaveBeenCalledWith("toast-1");
  });

  it("shows a warning toast listing failures when a card cannot be created", async () => {
    routeFetch(fetchMock, {
      [BOARD_GET]: jsonResponse(200, { data: prioritisedBoard() }),
      "POST /api/boards/b-1/columns": jsonResponse(201, {
        data: {
          id: "nc-1",
          board_id: "b-1",
          name: "Col A",
          position: 1,
          color: null,
          is_done: false,
          created_at: stamp,
          updated_at: stamp,
        },
      }),
      "POST /api/v1/columns/nc-1/cards": jsonResponse(400, {
        error: { code: "VALIDATION_ERROR", message: "bad", details: null },
      }),
    });
    render(<BoardDetailView boardId="b-1" />);
    await screen.findByRole("button", { name: "Open card: High one" });

    fireImportFile(
      JSON.stringify({
        board: {
          columns: [
            { name: "Col A", cards: [{ title: "Broken card" }] },
          ],
        },
      }),
    );

    await waitFor(() =>
      expect(showError).toHaveBeenCalledWith(expect.stringContaining("failed to create")),
    );
    expect(showSuccess).not.toHaveBeenCalled();
    expect(dismissToast).toHaveBeenCalled();
  });
});
