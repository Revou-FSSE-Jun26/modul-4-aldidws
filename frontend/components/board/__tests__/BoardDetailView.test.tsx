import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardDetailView } from "@/components/board/BoardDetailView";
import { useAuth } from "@/context/AuthContext";
import {
  errorResponse,
  jsonResponse,
  noContent,
  routeFetch,
} from "@/tests/fetchRoutes";

const mockReplace = jest.fn();
const mockPush = jest.fn();
// Stable object, like the real useRouter(), so effects do not re-run each render.
const mockRouter = { replace: mockReplace, push: mockPush };

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/boards/b-1",
}));
jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
const fetchMock = jest.fn();

const stamp = "2026-01-01T00:00:00Z";

function makeCard(id: string, columnId: string, title: string, order: number) {
  return {
    id,
    column_id: columnId,
    owner_id: "u-1",
    title,
    description: null,
    order,
    deleted_at: null,
    created_at: stamp,
    updated_at: stamp,
  };
}

function makeColumn(id: string, name: string, position: number, cards: unknown[]) {
  return {
    id,
    board_id: "b-1",
    name,
    position,
    created_at: stamp,
    updated_at: stamp,
    cards,
  };
}

function makeBoard(columns: unknown[]) {
  return {
    id: "b-1",
    name: "Board One",
    user_id: "u-1",
    created_at: stamp,
    updated_at: stamp,
    columns,
  };
}

const twoColumns = () =>
  makeBoard([
    makeColumn("c-1", "To Do", 1, [makeCard("card-1", "c-1", "Write spec", 0)]),
    makeColumn("c-2", "Done", 2, [
      makeCard("card-2", "c-2", "Ship it", 1),
      makeCard("card-3", "c-2", "Celebrate", 3),
    ]),
  ]);

const BOARD_GET = "GET /api/boards/b-1";

function dataTransfer(cardId: string) {
  return {
    setData: jest.fn(),
    getData: () => cardId,
    clearData: jest.fn(),
    effectAllowed: "",
    dropEffect: "",
  };
}

describe("BoardDetailView", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    mockUseAuth.mockReturnValue({
      token: "test-token",
      isLoading: false,
      currentUser: { id: "u-1", email: "a@b.co", name: "Ann", role: "user", timezone: "UTC" },
    });
  });

  describe("loading, auth and errors", () => {
    it("shows loading state and does not redirect or fetch while auth loads", () => {
      mockUseAuth.mockReturnValue({ token: null, isLoading: true });
      render(<BoardDetailView boardId="b-1" />);
      expect(screen.getByLabelText(/loading board/i)).toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    // Rewritten: the guard now sends the user to /login?next=<path> so login can return here.
    it("redirects to /login?next= after auth finishes loading without a token", () => {
      mockUseAuth.mockReturnValue({ token: null, isLoading: false });
      render(<BoardDetailView boardId="b-1" />);
      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith("/login?next=%2Fboards%2Fb-1");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    // Rewritten: the old test fed the 404/405-to-empty fallback; the board now
    // comes from ONE request (GET /api/boards/{id}) with columns and cards embedded.
    it("loads the board with a single request and the Authorization header", async () => {
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: twoColumns() }),
      });
      render(<BoardDetailView boardId="b-1" />);

      expect(
        await screen.findByRole("heading", { name: "Board One" }),
      ).toBeInTheDocument();
      expect(calls).toHaveLength(1);
      expect(calls[0].headers.Authorization).toBe("Bearer test-token");
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("shows the empty state for a board without columns", async () => {
      routeFetch(fetchMock, { [BOARD_GET]: jsonResponse(200, { data: makeBoard([]) }) });
      render(<BoardDetailView boardId="b-1" />);
      expect(
        await screen.findByText(/this board has no columns yet/i),
      ).toBeInTheDocument();
    });

    it("renders columns in position order with their cards", async () => {
      routeFetch(fetchMock, { [BOARD_GET]: jsonResponse(200, { data: twoColumns() }) });
      render(<BoardDetailView boardId="b-1" />);
      const todo = await screen.findByRole("listitem", { name: "To Do" });
      expect(within(todo).getByText("Write spec")).toBeInTheDocument();
      const done = screen.getByRole("listitem", { name: "Done" });
      const titles = within(done)
        .getAllByRole("button", { name: /open card/i })
        .map((b) => b.getAttribute("aria-label"));
      expect(titles).toEqual(["Open card: Ship it", "Open card: Celebrate"]);
    });

    it("lists a column with no cards", async () => {
      routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: makeBoard([makeColumn("c-1", "To Do", 1, [])]) }),
      });
      render(<BoardDetailView boardId="b-1" />);
      expect(await screen.findByText(/no cards in this column/i)).toBeInTheDocument();
    });

    it("shows a not-found alert when the board returns 404", async () => {
      routeFetch(fetchMock, { [BOARD_GET]: errorResponse(404, "BOARD_NOT_FOUND", "x") });
      render(<BoardDetailView boardId="b-1" />);
      expect(await screen.findByRole("alert")).toHaveTextContent(/board not found/i);
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("shows an alert when the board request fails with 500", async () => {
      routeFetch(fetchMock, { [BOARD_GET]: jsonResponse(500, {}) });
      render(<BoardDetailView boardId="b-1" />);
      expect(await screen.findByRole("alert")).toHaveTextContent(/status 500/i);
    });

    it("shows an alert on a network failure", async () => {
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
      render(<BoardDetailView boardId="b-1" />);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        /could not load this board/i,
      );
    });

    it("redirects to /login?next= when the API returns 401", async () => {
      mockUseAuth.mockReturnValue({ token: "expired", isLoading: false });
      routeFetch(fetchMock, { [BOARD_GET]: jsonResponse(401, {}) });
      render(<BoardDetailView boardId="b-1" />);
      await waitFor(() =>
        expect(mockReplace).toHaveBeenCalledWith("/login?next=%2Fboards%2Fb-1"),
      );
    });
  });

  describe("columns and cards", () => {
    it("adds a column with exactly {name}", async () => {
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: makeBoard([]) }),
        "POST /api/boards/b-1/columns": jsonResponse(201, {
          data: { ...makeColumn("c-9", "Backlog", 1, []), cards: undefined },
        }),
      });
      render(<BoardDetailView boardId="b-1" />);
      await userEvent.click(await screen.findByRole("button", { name: "Add column" }));
      await userEvent.type(screen.getByLabelText("Column name"), "Backlog");
      await userEvent.click(screen.getByRole("button", { name: "Create column" }));

      expect(await screen.findByRole("listitem", { name: "Backlog" })).toBeInTheDocument();
      const post = calls.find((c) => c.method === "POST");
      expect(post?.body).toEqual({ name: "Backlog" });
    });

    it("keeps the typed name and shows the server message when column creation fails", async () => {
      routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: makeBoard([]) }),
        "POST /api/boards/b-1/columns": errorResponse(
          409,
          "RESOURCE_CONFLICT",
          "A column with that name already exists.",
        ),
      });
      render(<BoardDetailView boardId="b-1" />);
      await userEvent.click(await screen.findByRole("button", { name: "Add column" }));
      await userEvent.type(screen.getByLabelText("Column name"), "Dup");
      await userEvent.click(screen.getByRole("button", { name: "Create column" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(/already exists/i);
      expect(screen.getByLabelText("Column name")).toHaveValue("Dup");
    });

    it("adds a card with exactly {title} to the right column", async () => {
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: twoColumns() }),
        "POST /api/v1/columns/c-2/cards": jsonResponse(201, {
          data: makeCard("card-9", "c-2", "New thing", 5),
        }),
      });
      render(<BoardDetailView boardId="b-1" />);
      const done = await screen.findByRole("listitem", { name: "Done" });
      await userEvent.click(within(done).getByRole("button", { name: "Add card to Done" }));
      await userEvent.type(within(done).getByLabelText("Card title"), "New thing");
      await userEvent.click(within(done).getByRole("button", { name: "Save card" }));

      expect(await within(done).findByText("New thing")).toBeInTheDocument();
      expect(
        within(screen.getByRole("listitem", { name: "To Do" })).queryByText("New thing"),
      ).not.toBeInTheDocument();
      expect(calls.find((c) => c.method === "POST")?.body).toEqual({ title: "New thing" });
    });

    it("renames a column with exactly {name}", async () => {
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: twoColumns() }),
        "PATCH /api/columns/c-1": jsonResponse(200, {
          data: makeColumn("c-1", "Doing", 1, []),
        }),
      });
      render(<BoardDetailView boardId="b-1" />);
      await userEvent.click(
        await screen.findByRole("button", { name: "Rename column: To Do" }),
      );
      const input = screen.getByRole("textbox", { name: "Column name" });
      await userEvent.clear(input);
      await userEvent.type(input, "Doing{Enter}");

      expect(await screen.findByRole("listitem", { name: "Doing" })).toBeInTheDocument();
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ name: "Doing" });
    });

    it("deletes an empty column after confirmation", async () => {
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, {
          data: makeBoard([makeColumn("c-1", "Empty", 1, [])]),
        }),
        "DELETE /api/columns/c-1": noContent(),
      });
      render(<BoardDetailView boardId="b-1" />);
      await userEvent.click(
        await screen.findByRole("button", { name: "Delete column: Empty" }),
      );
      await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
      await waitFor(() =>
        expect(screen.queryByRole("listitem", { name: "Empty" })).not.toBeInTheDocument(),
      );
      expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/columns/c-1")).toBe(true);
    });

    it("shows the 409 message and keeps the column when it still has cards", async () => {
      routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: twoColumns() }),
        "DELETE /api/columns/c-1": errorResponse(409, "RESOURCE_CONFLICT", "server text"),
      });
      render(<BoardDetailView boardId="b-1" />);
      await userEvent.click(
        await screen.findByRole("button", { name: "Delete column: To Do" }),
      );
      await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "This column still has cards. Move or delete them first.",
      );
      expect(screen.getByRole("listitem", { name: "To Do" })).toBeInTheDocument();
    });
  });

  describe("drag and drop", () => {
    it("sends exactly {column_id, order} for a drop before a card, then refetches", async () => {
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: twoColumns() }),
        "PATCH /api/v1/cards/card-1/position": jsonResponse(200, {
          data: makeCard("card-1", "c-2", "Write spec", 2),
        }),
      });
      render(<BoardDetailView boardId="b-1" />);
      const source = (await screen.findByRole("button", { name: "Open card: Write spec" })).closest("li") as HTMLElement;
      const target = screen.getByRole("button", { name: "Open card: Celebrate" }).closest("li") as HTMLElement;

      fireEvent.dragStart(source, { dataTransfer: dataTransfer("card-1") });
      fireEvent.drop(target, { dataTransfer: dataTransfer("card-1") });

      await waitFor(() =>
        expect(calls.filter((c) => c.method === "GET")).toHaveLength(2),
      );
      const patch = calls.find((c) => c.method === "PATCH");
      expect(patch?.path).toBe("/api/v1/cards/card-1/position");
      // between Ship it (1) and Celebrate (3)
      expect(patch?.body).toEqual({ column_id: "c-2", order: 2 });
    });

    it("appends after the last card when dropped on the column body", async () => {
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: twoColumns() }),
        "PATCH /api/v1/cards/card-1/position": jsonResponse(200, {
          data: makeCard("card-1", "c-2", "Write spec", 4),
        }),
      });
      render(<BoardDetailView boardId="b-1" />);
      const source = (await screen.findByRole("button", { name: "Open card: Write spec" })).closest("li") as HTMLElement;
      fireEvent.dragStart(source, { dataTransfer: dataTransfer("card-1") });
      fireEvent.drop(screen.getByRole("listitem", { name: "Done" }), {
        dataTransfer: dataTransfer("card-1"),
      });
      await waitFor(() => expect(calls.filter((c) => c.method === "GET")).toHaveLength(2));
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
        column_id: "c-2",
        order: 4,
      });
    });

    it("moves the card optimistically", async () => {
      let release: (r: unknown) => void = () => {};
      const pending = new Promise((resolve) => (release = resolve));
      routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: twoColumns() }),
        "PATCH /api/v1/cards/card-1/position": (() => pending) as never,
      });
      render(<BoardDetailView boardId="b-1" />);
      const source = (await screen.findByRole("button", { name: "Open card: Write spec" })).closest("li") as HTMLElement;
      fireEvent.dragStart(source, { dataTransfer: dataTransfer("card-1") });
      fireEvent.drop(screen.getByRole("listitem", { name: "Done" }), {
        dataTransfer: dataTransfer("card-1"),
      });
      expect(
        within(screen.getByRole("listitem", { name: "Done" })).getByText("Write spec"),
      ).toBeInTheDocument();
      release(jsonResponse(200, { data: makeCard("card-1", "c-2", "Write spec", 4) }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    });

    it("rolls the card back and shows an alert when the server rejects the move", async () => {
      routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: twoColumns() }),
        "PATCH /api/v1/cards/card-1/position": errorResponse(500, "INTERNAL_ERROR", "boom"),
      });
      render(<BoardDetailView boardId="b-1" />);
      const source = (await screen.findByRole("button", { name: "Open card: Write spec" })).closest("li") as HTMLElement;
      fireEvent.dragStart(source, { dataTransfer: dataTransfer("card-1") });
      fireEvent.drop(screen.getByRole("listitem", { name: "Done" }), {
        dataTransfer: dataTransfer("card-1"),
      });

      expect(await screen.findByRole("alert")).toHaveTextContent(/could not move the card/i);
      expect(
        within(screen.getByRole("listitem", { name: "To Do" })).getByText("Write spec"),
      ).toBeInTheDocument();
      expect(
        within(screen.getByRole("listitem", { name: "Done" })).queryByText("Write spec"),
      ).not.toBeInTheDocument();
    });

    it("ignores a card dropped onto itself", async () => {
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: twoColumns() }),
      });
      render(<BoardDetailView boardId="b-1" />);
      const source = (await screen.findByRole("button", { name: "Open card: Write spec" })).closest("li") as HTMLElement;
      fireEvent.dragStart(source, { dataTransfer: dataTransfer("card-1") });
      fireEvent.drop(source, { dataTransfer: dataTransfer("card-1") });
      expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(0);
    });
  });

  describe("card dialog and search", () => {
    const commentsRoute = {
      "GET /api/cards/card-1/comments": jsonResponse(200, { data: [] }),
    };

    it("opens the card dialog from a card", async () => {
      routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: twoColumns() }),
        ...commentsRoute,
      });
      render(<BoardDetailView boardId="b-1" />);
      await userEvent.click(await screen.findByRole("button", { name: "Open card: Write spec" }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByLabelText("Card title")).toHaveValue("Write spec");
    });

    it("searches within the board and opens the picked card", async () => {
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: twoColumns() }),
        "GET /api/v1/cards?search=spec&board_id=b-1&per_page=20": jsonResponse(200, {
          data: [
            {
              ...makeCard("card-1", "c-1", "Write spec", 0),
              board_id: "b-1",
              board_name: "Board One",
              column_name: "To Do",
            },
          ],
          meta: { page: 1, per_page: 20, total: 1 },
        }),
        ...commentsRoute,
      });
      render(<BoardDetailView boardId="b-1" />);
      await userEvent.type(await screen.findByLabelText("Search cards"), "spec");
      const results = await screen.findByRole("list", { name: "Search results" });
      await userEvent.click(within(results).getByRole("button", { name: /write spec/i }));

      expect(await screen.findByRole("dialog")).toBeInTheDocument();
      expect(calls.some((c) => c.path.startsWith("/api/v1/cards?search=spec"))).toBe(true);
    });
  });
});
