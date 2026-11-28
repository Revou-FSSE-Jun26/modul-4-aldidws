import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardDetailView } from "@/components/board/BoardDetailView";
import { useAuth } from "@/context/AuthContext";
import { showError, showSuccess } from "@/lib/toast";
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

let mockSearch = "";
let mockParams = { key: "", value: new URLSearchParams("") };

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/boards/b-1",
  useSearchParams: () => {
    // Stable per query string, like the real hook between navigations.
    if (mockParams.key !== mockSearch) {
      mockParams = { key: mockSearch, value: new URLSearchParams(mockSearch) };
    }
    return mockParams.value;
  },
}));
jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/toast", () => ({ showError: jest.fn(), showSuccess: jest.fn() }));

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
    due_date: null,
    priority: null,
    labels: [],
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
    labels: [] as unknown[],
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
    setDragImage: jest.fn(),
    effectAllowed: "",
    dropEffect: "",
  };
}

describe("BoardDetailView", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockSearch = "";
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    mockUseAuth.mockReturnValue({
      token: "test-token",
      isAuthLoading: false,
      currentUser: { id: "u-1", email: "a@b.co", name: "Ann", role: "user", timezone: "UTC" },
    });
  });

  describe("labels", () => {
    it("shows label pills with their names on the cards of the board", async () => {
      const tagged = {
        ...makeCard("card-1", "c-1", "Tagged card", 0),
        labels: [
          { id: "l-1", name: "Bug", color: "red" },
          { id: "l-2", name: "Docs", color: "blue" },
        ],
      };
      routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, {
          data: makeBoard([makeColumn("c-1", "To Do", 1, [tagged, makeCard("card-2", "c-1", "Plain card", 1)])]),
        }),
      });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("button", { name: "Open card: Tagged card" });
      expect(screen.getByText("Bug")).toBeInTheDocument();
      expect(screen.getByText("Docs")).toBeInTheDocument();
      expect(screen.getAllByText("Bug")).toHaveLength(1);
    });
  });

  describe("due dates", () => {
    it("shows a due badge only on cards that have a due date", async () => {
      const dated = { ...makeCard("card-1", "c-1", "Late card", 0), due_date: "2020-01-01T00:00:00Z" };
      routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, {
          data: makeBoard([
            makeColumn("c-1", "To Do", 1, [dated, makeCard("card-2", "c-1", "Plain card", 1)]),
          ]),
        }),
      });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("button", { name: "Open card: Late card" });
      expect(screen.getAllByText("Overdue")).toHaveLength(1);
      expect(screen.getByRole("button", { name: "Open card: Plain card" })).toBeInTheDocument();
    });
  });

  describe("filters", () => {
    const BUG_ID = "11111111-1111-4111-8111-111111111111";
    const DOCS_ID = "22222222-2222-4222-8222-222222222222";
    const bugLabel = { id: BUG_ID, name: "Bug", color: "red" };
    const docsLabel = { id: DOCS_ID, name: "Docs", color: "blue" };

    function filterBoard() {
      const board = makeBoard([
        makeColumn("c-1", "To Do", 1, [
          { ...makeCard("card-1", "c-1", "Write spec", 0), labels: [bugLabel] },
          makeCard("card-4", "c-1", "Plan sprint", 1),
        ]),
        makeColumn("c-2", "Done", 2, [
          makeCard("card-2", "c-2", "Ship it", 1),
          { ...makeCard("card-3", "c-2", "Celebrate", 3), description: "Cake and Spec talk" },
        ]),
      ]);
      board.labels = [
        { ...bugLabel, board_id: "b-1", created_at: stamp, updated_at: stamp },
        { ...docsLabel, board_id: "b-1", created_at: stamp, updated_at: stamp },
      ];
      return board;
    }

    const cardButton = (title: string) =>
      screen.queryByRole("button", { name: `Open card: ${title}` });

    it("hides non-matching cards while typing, shows x of y and restores on Clear", async () => {
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: filterBoard() }),
        "GET /api/notifications": jsonResponse(200, {
          data: [],
          meta: { unread_count: 0 },
        }),
      });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("button", { name: "Open card: Write spec" });

      await userEvent.type(screen.getByRole("searchbox", { name: "Filter cards" }), "spec");

      // Title match and description match stay; the others are not rendered.
      expect(cardButton("Write spec")).toBeInTheDocument();
      expect(cardButton("Celebrate")).toBeInTheDocument();
      expect(cardButton("Plan sprint")).not.toBeInTheDocument();
      expect(cardButton("Ship it")).not.toBeInTheDocument();
      // Both columns show one of two cards.
      const badges = screen.getAllByLabelText("1 of 2 cards shown");
      expect(badges).toHaveLength(2);
      expect(badges[0]).toHaveTextContent("1 of 2");
      expect(screen.queryByText("No cards match these filters.")).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
      expect(cardButton("Plan sprint")).toBeInTheDocument();
      expect(cardButton("Ship it")).toBeInTheDocument();
      expect(screen.getByRole("searchbox", { name: "Filter cards" })).toHaveValue("");
      // Filtering never calls the API again (board call + notifications = 2 non-filter calls).
      expect(calls.filter((c) => c.path === "/api/boards/b-1")).toHaveLength(1);
    });

    it("shows one status message when nothing matches and keeps the columns", async () => {
      routeFetch(fetchMock, { [BOARD_GET]: jsonResponse(200, { data: filterBoard() }) });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("button", { name: "Open card: Write spec" });

      await userEvent.type(screen.getByRole("searchbox", { name: "Filter cards" }), "zzz");

      expect(screen.getAllByText("No cards match these filters.")).toHaveLength(1);
      expect(screen.getByRole("status")).toHaveTextContent("No cards match these filters.");
      expect(screen.getByRole("listitem", { name: "To Do" })).toBeInTheDocument();
      // Columns that still hold hidden cards do not claim to be empty.
      expect(screen.queryByText("No tasks")).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
      expect(screen.queryByText("No cards match these filters.")).not.toBeInTheDocument();
      expect(cardButton("Ship it")).toBeInTheDocument();
    });

    it("writes label and due date choices to the URL at once", async () => {
      const soon = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const board = filterBoard();
      board.columns = [
        makeColumn("c-1", "To Do", 1, [
          { ...makeCard("card-1", "c-1", "Write spec", 0), labels: [bugLabel], due_date: soon },
          { ...makeCard("card-4", "c-1", "Plan sprint", 1), labels: [docsLabel] },
          { ...makeCard("card-5", "c-1", "Fix bug", 2), labels: [bugLabel] },
        ]),
      ];
      routeFetch(fetchMock, { [BOARD_GET]: jsonResponse(200, { data: board }) });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("button", { name: "Open card: Write spec" });

      // The URL mock does not change, so each choice is checked through router.replace.
      await userEvent.click(screen.getByRole("button", { name: "Any label" }));
      await userEvent.click(screen.getByRole("option", { name: /Bug/ }));
      expect(mockReplace).toHaveBeenLastCalledWith(`/boards/b-1?labels=${BUG_ID}`, {
        scroll: false,
      });

      await userEvent.selectOptions(screen.getByLabelText("Due date"), "24h");
      expect(mockReplace).toHaveBeenLastCalledWith("/boards/b-1?due=24h", { scroll: false });
    });

    it("shows only cards with any selected label, then narrows with the due date (AND)", async () => {
      const soon = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const board = filterBoard();
      board.columns = [
        makeColumn("c-1", "To Do", 1, [
          { ...makeCard("card-1", "c-1", "Write spec", 0), labels: [bugLabel], due_date: soon },
          { ...makeCard("card-4", "c-1", "Plan sprint", 1), labels: [docsLabel] },
          { ...makeCard("card-5", "c-1", "Fix bug", 2), labels: [bugLabel] },
          makeCard("card-6", "c-1", "Unlabelled", 3),
        ]),
      ];
      mockSearch = `labels=${BUG_ID},${DOCS_ID}`;
      routeFetch(fetchMock, { [BOARD_GET]: jsonResponse(200, { data: board }) });
      const { unmount } = render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("button", { name: "Open card: Write spec" });
      expect(cardButton("Plan sprint")).toBeInTheDocument();
      expect(cardButton("Fix bug")).toBeInTheDocument();
      expect(cardButton("Unlabelled")).not.toBeInTheDocument();
      unmount();

      mockSearch = `labels=${BUG_ID},${DOCS_ID}&due=24h`;
      routeFetch(fetchMock, { [BOARD_GET]: jsonResponse(200, { data: board }) });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("button", { name: "Open card: Write spec" });
      expect(cardButton("Plan sprint")).not.toBeInTheDocument();
      expect(cardButton("Fix bug")).not.toBeInTheDocument();
    });

    it("applies filters from the URL, keeps the URL untouched and ignores invalid values", async () => {
      mockSearch = `q=spec&labels=${BUG_ID},not-a-uuid&due=bogus&utm=1`;
      routeFetch(fetchMock, { [BOARD_GET]: jsonResponse(200, { data: filterBoard() }) });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("button", { name: "Open card: Write spec" });

      expect(screen.getByRole("searchbox", { name: "Filter cards" })).toHaveValue("spec");
      expect(cardButton("Write spec")).toBeInTheDocument();
      // Celebrate matches the keyword but lacks the Bug label.
      expect(cardButton("Celebrate")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Due date")).toHaveValue("any");
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("ignores a label id of another board without rewriting the URL", async () => {
      mockSearch = "labels=99999999-9999-4999-8999-999999999999";
      routeFetch(fetchMock, { [BOARD_GET]: jsonResponse(200, { data: filterBoard() }) });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("button", { name: "Open card: Write spec" });
      expect(cardButton("Ship it")).toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("writes the URL after the keyword settles, keeping unrelated keys", async () => {
      mockSearch = "utm=1";
      routeFetch(fetchMock, { [BOARD_GET]: jsonResponse(200, { data: filterBoard() }) });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("button", { name: "Open card: Write spec" });

      await userEvent.type(screen.getByRole("searchbox", { name: "Filter cards" }), "ship");
      expect(mockReplace).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(mockReplace).toHaveBeenCalledWith("/boards/b-1?utm=1&q=ship", { scroll: false }),
      );
    });

    it("turns dragging off while a filter is active and shows a notice", async () => {
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: filterBoard() }),
      });
      render(<BoardDetailView boardId="b-1" />);
      const before = (await screen.findByRole("button", { name: "Open card: Write spec" })).closest("li") as HTMLElement;
      expect(before).toHaveAttribute("draggable", "true");
      expect(screen.queryByText(/dragging is turned off/i)).not.toBeInTheDocument();

      await userEvent.type(screen.getByRole("searchbox", { name: "Filter cards" }), "e");
      const card = screen.getByRole("button", { name: "Open card: Write spec" }).closest("li") as HTMLElement;
      expect(card).not.toHaveAttribute("draggable");
      expect(screen.getByText(/dragging is turned off/i)).toBeInTheDocument();

      fireEvent.drop(screen.getByRole("listitem", { name: "Done" }), {
        dataTransfer: dataTransfer("card-1"),
      });
      expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(0);
    });

    it("keeps Move to column working against the complete column while filtered", async () => {
      mockSearch = "q=write";
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: filterBoard() }),
        "GET /api/cards/card-1/comments": jsonResponse(200, { data: [] }),
        "PATCH /api/v1/cards/card-1/position": jsonResponse(200, {
          data: makeCard("card-1", "c-2", "Write spec", 4),
        }),
      });
      render(<BoardDetailView boardId="b-1" />);
      await userEvent.click(await screen.findByRole("button", { name: "Open card: Write spec" }));
      const dialog = await screen.findByRole("dialog");
      expect(cardButton("Celebrate")).not.toBeInTheDocument();

      await userEvent.selectOptions(within(dialog).getByLabelText("Move to column"), "c-2");
      await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
      // After the hidden Celebrate (order 3), not between the visible cards.
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
        column_id: "c-2",
        order: 4,
      });
    });

    it("focuses the filter input with the f key but not inside a text field", async () => {
      routeFetch(fetchMock, { [BOARD_GET]: jsonResponse(200, { data: filterBoard() }) });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("button", { name: "Open card: Write spec" });

      await userEvent.keyboard("f");
      const input = screen.getByRole("searchbox", { name: "Filter cards" });
      expect(input).toHaveFocus();
      expect(input).toHaveValue("");
    });
  });

  describe("loading, auth and errors", () => {
    it("shows loading state and does not redirect or fetch while auth loads", () => {
      mockUseAuth.mockReturnValue({ token: null, isAuthLoading: true });
      render(<BoardDetailView boardId="b-1" />);
      expect(screen.getByLabelText(/loading board/i)).toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    // Rewritten: the guard now sends the user to /login?next=<path> so login can return here.
    it("redirects to /login?next= after auth finishes loading without a token", () => {
      mockUseAuth.mockReturnValue({ token: null, isAuthLoading: false });
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
        "GET /api/notifications": jsonResponse(200, {
          data: [],
          meta: { unread_count: 0 },
        }),
      });
      render(<BoardDetailView boardId="b-1" />);

      expect(
        await screen.findByRole("heading", { name: "Board One" }),
      ).toBeInTheDocument();
      // The board itself is loaded with exactly ONE request.
      const boardCalls = calls.filter((c) => c.path === "/api/boards/b-1");
      expect(boardCalls).toHaveLength(1);
      expect(boardCalls[0].headers.Authorization).toBe("Bearer test-token");
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
      expect(await screen.findByText("No tasks")).toBeInTheDocument();
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
      mockUseAuth.mockReturnValue({ token: "expired", isAuthLoading: false });
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
      await userEvent.click(
        await screen.findByRole("button", { name: "Open add new menu" }),
      );
      await userEvent.click(screen.getByRole("menuitem", { name: "New Column" }));
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
      await userEvent.click(
        await screen.findByRole("button", { name: "Open add new menu" }),
      );
      await userEvent.click(screen.getByRole("menuitem", { name: "New Column" }));
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

    describe("column + button (add task to top)", () => {
      const cardTitles = (column: HTMLElement) =>
        within(column)
          .getAllByRole("button", { name: /^Open card: / })
          .map((b) => b.getAttribute("aria-label"));

      it("opens the form at the top of the column with focus, and Escape returns focus to +", async () => {
        routeFetch(fetchMock, { [BOARD_GET]: jsonResponse(200, { data: twoColumns() }) });
        render(<BoardDetailView boardId="b-1" />);
        const done = await screen.findByRole("listitem", { name: "Done" });
        const plus = within(done).getByRole("button", { name: "Add task to top of Done" });
        await userEvent.click(plus);

        const input = within(done).getByLabelText("Card title");
        expect(input).toHaveFocus();
        const firstCard = within(done).getAllByRole("button", { name: /^Open card: / })[0];
        expect(
          input.compareDocumentPosition(firstCard) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();

        await userEvent.keyboard("{Escape}");
        expect(within(done).queryByLabelText("Card title")).not.toBeInTheDocument();
        expect(plus).toHaveFocus();
      });

      it("opens from the keyboard and Cancel returns focus to +", async () => {
        routeFetch(fetchMock, { [BOARD_GET]: jsonResponse(200, { data: twoColumns() }) });
        render(<BoardDetailView boardId="b-1" />);
        const todo = await screen.findByRole("listitem", { name: "To Do" });
        const plus = within(todo).getByRole("button", { name: "Add task to top of To Do" });
        plus.focus();
        await userEvent.keyboard("{Enter}");
        expect(within(todo).getByLabelText("Card title")).toHaveFocus();

        await userEvent.click(within(todo).getByRole("button", { name: "Cancel" }));
        expect(plus).toHaveFocus();
      });

      it("sends position top and renders the new card first, shifting the others", async () => {
        const calls = routeFetch(fetchMock, {
          [BOARD_GET]: jsonResponse(200, { data: twoColumns() }),
          // Server shifted "Ship it" (1) and "Celebrate" (3) to 2 and 4 when it took order 1.
          "POST /api/v1/columns/c-2/cards": jsonResponse(201, {
            data: makeCard("card-9", "c-2", "Top task", 1),
          }),
        });
        render(<BoardDetailView boardId="b-1" />);
        const done = await screen.findByRole("listitem", { name: "Done" });
        await userEvent.click(within(done).getByRole("button", { name: "Add task to top of Done" }));
        await userEvent.type(within(done).getByLabelText("Card title"), "Top task");
        await userEvent.click(within(done).getByRole("button", { name: "Save card" }));

        await within(done).findByText("Top task");
        expect(cardTitles(done)).toEqual([
          "Open card: Top task",
          "Open card: Ship it",
          "Open card: Celebrate",
        ]);
        expect(within(done).queryByLabelText("Card title")).not.toBeInTheDocument();
        expect(calls.find((c) => c.method === "POST")?.body).toEqual({
          title: "Top task",
          position: "top",
        });
      });

      it("keeps the typed title and shows the error when creation fails", async () => {
        routeFetch(fetchMock, {
          [BOARD_GET]: jsonResponse(200, { data: twoColumns() }),
          "POST /api/v1/columns/c-1/cards": errorResponse(
            400,
            "VALIDATION_ERROR",
            "The request contains invalid fields.",
          ),
        });
        render(<BoardDetailView boardId="b-1" />);
        const todo = await screen.findByRole("listitem", { name: "To Do" });
        await userEvent.click(within(todo).getByRole("button", { name: "Add task to top of To Do" }));
        await userEvent.type(within(todo).getByLabelText("Card title"), "Keep me");
        await userEvent.click(within(todo).getByRole("button", { name: "Save card" }));

        expect(await within(todo).findByRole("alert")).toHaveTextContent(/invalid fields/i);
        expect(within(todo).getByLabelText("Card title")).toHaveValue("Keep me");
        expect(cardTitles(todo)).toEqual(["Open card: Write spec"]);
      });

      it("leaves the bottom Add card flow unchanged (no position, appended last)", async () => {
        const calls = routeFetch(fetchMock, {
          [BOARD_GET]: jsonResponse(200, { data: twoColumns() }),
          "POST /api/v1/columns/c-2/cards": jsonResponse(201, {
            data: makeCard("card-9", "c-2", "Bottom task", 4),
          }),
        });
        render(<BoardDetailView boardId="b-1" />);
        const done = await screen.findByRole("listitem", { name: "Done" });
        await userEvent.click(within(done).getByRole("button", { name: "Add card to Done" }));
        await userEvent.type(within(done).getByLabelText("Card title"), "Bottom task");
        await userEvent.click(within(done).getByRole("button", { name: "Save card" }));

        await within(done).findByText("Bottom task");
        expect(cardTitles(done)).toEqual([
          "Open card: Ship it",
          "Open card: Celebrate",
          "Open card: Bottom task",
        ]);
        expect(calls.find((c) => c.method === "POST")?.body).toEqual({ title: "Bottom task" });
      });
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

    it("sends the chosen color and updates data-status; Automatic sends null", async () => {
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: twoColumns() }),
        "PATCH /api/columns/c-1": jsonResponse(200, {
          data: { ...makeColumn("c-1", "To Do", 1, []), color: "red" },
        }),
      });
      render(<BoardDetailView boardId="b-1" />);
      const column = await screen.findByRole("listitem", { name: "To Do" });
      expect(within(column).getByRole("banner")).toHaveAttribute("data-status", "gray");
      await userEvent.click(within(column).getByRole("button", { name: "Column actions for To Do" }));
      await userEvent.click(screen.getByRole("menuitemradio", { name: "Red" }));
      await waitFor(() =>
        expect(within(column).getByRole("banner")).toHaveAttribute("data-status", "red"),
      );
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ color: "red" });
    });
    it("sends color null for Automatic and falls back to the position color", async () => {
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, {
          data: makeBoard([{ ...makeColumn("c-1", "To Do", 1, []), color: "red" }]),
        }),
        "PATCH /api/columns/c-1": jsonResponse(200, {
          data: makeColumn("c-1", "To Do", 1, []),
        }),
      });
      render(<BoardDetailView boardId="b-1" />);
      const column = await screen.findByRole("listitem", { name: "To Do" });
      await userEvent.click(within(column).getByRole("button", { name: "Column actions for To Do" }));
      expect(screen.getByRole("menuitemradio", { name: "Red" })).toHaveAttribute("aria-checked", "true");
      await userEvent.click(screen.getByRole("menuitemradio", { name: "Automatic" }));
      await waitFor(() =>
        expect(within(column).getByRole("banner")).toHaveAttribute("data-status", "gray"),
      );
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ color: null });
    });
    it("toggles the Done flag and updates data-done", async () => {
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: twoColumns() }),
        "PATCH /api/columns/c-1": jsonResponse(200, {
          data: { ...makeColumn("c-1", "To Do", 1, []), is_done: true },
        }),
      });
      render(<BoardDetailView boardId="b-1" />);
      const column = await screen.findByRole("listitem", { name: "To Do" });
      expect(within(column).getByRole("banner")).toHaveAttribute("data-done", "false");
      await userEvent.click(within(column).getByRole("button", { name: "Column actions for To Do" }));
      await userEvent.click(screen.getByRole("menuitem", { name: "Mark as Done column" }));
      await waitFor(() =>
        expect(within(column).getByRole("banner")).toHaveAttribute("data-done", "true"),
      );
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ is_done: true });
      await userEvent.click(within(column).getByRole("button", { name: "Column actions for To Do" }));
      expect(screen.getByRole("menuitem", { name: "Unmark Done column" })).toBeInTheDocument();
    });
    it("keeps the previous color and shows an error toast when the update fails", async () => {
      (showError as jest.Mock).mockReset();
      routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: twoColumns() }),
        "PATCH /api/columns/c-1": errorResponse(400, "VALIDATION_ERROR", "Invalid color"),
      });
      render(<BoardDetailView boardId="b-1" />);
      const column = await screen.findByRole("listitem", { name: "To Do" });
      await userEvent.click(within(column).getByRole("button", { name: "Column actions for To Do" }));
      await userEvent.click(screen.getByRole("menuitemradio", { name: "Blue" }));
      await waitFor(() => expect(showError).toHaveBeenCalled());
      expect(within(column).getByRole("banner")).toHaveAttribute("data-status", "gray");
    });
    it("starts the inline rename from the column menu", async () => {
      routeFetch(fetchMock, { [BOARD_GET]: jsonResponse(200, { data: twoColumns() }) });
      render(<BoardDetailView boardId="b-1" />);
      await userEvent.click(await screen.findByRole("button", { name: "Column actions for To Do" }));
      await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
      expect(screen.getByRole("textbox", { name: "Column name" })).toHaveValue("To Do");
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
        await screen.findByRole("button", { name: "Column actions for Empty" }),
      );
      await userEvent.click(screen.getByRole("menuitem", { name: "Delete column" }));
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
        await screen.findByRole("button", { name: "Column actions for To Do" }),
      );
      await userEvent.click(screen.getByRole("menuitem", { name: "Delete column" }));
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

  });

  describe("column reorder", () => {
    const REORDER = "PATCH /api/boards/b-1/columns/reorder";
    const threeColumns = () =>
      makeBoard([
        makeColumn("c-1", "To Do", 0, [makeCard("card-1", "c-1", "Write spec", 0)]),
        makeColumn("c-2", "Doing", 1, []),
        makeColumn("c-3", "Done", 2, []),
      ]);
    const columnNames = () =>
      screen.getAllByRole("listitem").filter((el) => el.tagName === "SECTION").map((el) => el.getAttribute("aria-label"));

    beforeEach(() => {
      (showError as jest.Mock).mockReset();
    });

    it("moves the column with ArrowRight, sends the full ordered ids and keeps focus on the handle", async () => {
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: threeColumns() }),
        [REORDER]: jsonResponse(200, { data: [] }),
      });
      render(<BoardDetailView boardId="b-1" />);
      const handle = await screen.findByRole("button", { name: "Reorder column To Do" });
      handle.focus();
      await userEvent.keyboard("{ArrowRight}");
      await waitFor(() => expect(columnNames()).toEqual(["Doing", "To Do", "Done"]));
      const sent = calls.find((c) => c.method === "PATCH");
      expect(sent?.body).toEqual({ ordered_ids: ["c-2", "c-1", "c-3"] });
      expect(screen.getByRole("button", { name: "Reorder column To Do" })).toHaveFocus();
      expect(showError).not.toHaveBeenCalled();
    });

    it("does nothing when moving the first column left", async () => {
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: threeColumns() }),
      });
      render(<BoardDetailView boardId="b-1" />);
      const handle = await screen.findByRole("button", { name: "Reorder column To Do" });
      handle.focus();
      await userEvent.keyboard("{ArrowLeft}");
      expect(columnNames()).toEqual(["To Do", "Doing", "Done"]);
      expect(calls.some((c) => c.method === "PATCH")).toBe(false);
    });

    it("restores the previous order and shows an error toast when the request fails", async () => {
      routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: threeColumns() }),
        [REORDER]: errorResponse(500, "INTERNAL_ERROR", "boom"),
      });
      render(<BoardDetailView boardId="b-1" />);
      const handle = await screen.findByRole("button", { name: "Reorder column To Do" });
      handle.focus();
      await userEvent.keyboard("{ArrowRight}");
      await waitFor(() => expect(showError).toHaveBeenCalledTimes(1));
      expect(columnNames()).toEqual(["To Do", "Doing", "Done"]);
    });

    it("reorders by dragging a handle onto another column", async () => {
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: threeColumns() }),
        [REORDER]: jsonResponse(200, { data: [] }),
      });
      render(<BoardDetailView boardId="b-1" />);
      const handle = await screen.findByRole("button", { name: "Reorder column To Do" });
      const dt = { setData: jest.fn(), getData: () => "", effectAllowed: "", dropEffect: "" };
      fireEvent.dragStart(handle, { dataTransfer: dt });
      fireEvent.drop(screen.getByRole("listitem", { name: "Done" }), { dataTransfer: dt });
      await waitFor(() => expect(columnNames()).toEqual(["Doing", "Done", "To Do"]));
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
        ordered_ids: ["c-2", "c-3", "c-1"],
      });
    });

    it("does not run card drop handlers while a column is dragged over a card", async () => {
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: threeColumns() }),
        [REORDER]: jsonResponse(200, { data: [] }),
      });
      render(<BoardDetailView boardId="b-1" />);
      const handle = await screen.findByRole("button", { name: "Reorder column Doing" });
      const dt = { setData: jest.fn(), getData: () => "card-1", effectAllowed: "", dropEffect: "" };
      fireEvent.dragStart(handle, { dataTransfer: dt });
      const cardItem = screen.getByRole("button", { name: "Open card: Write spec" }).closest("li") as HTMLElement;
      fireEvent.drop(cardItem, { dataTransfer: dt });
      await waitFor(() => expect(columnNames()).toEqual(["Doing", "To Do", "Done"]));
      expect(calls.some((c) => c.path.includes("/position"))).toBe(false);
    });

    it("still moves a card dropped on a column normally", async () => {
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: threeColumns() }),
        "PATCH /api/v1/cards/card-1/position": jsonResponse(200, { data: {} }),
      });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("button", { name: "Reorder column Doing" });
      fireEvent.drop(screen.getByRole("listitem", { name: "Doing" }), { dataTransfer: dataTransfer("card-1") });
      await waitFor(() => expect(calls.some((c) => c.path === "/api/v1/cards/card-1/position")).toBe(true));
      expect(calls.some((c) => c.path.includes("/columns/reorder"))).toBe(false);
    });

    it("hides the handles when the board has a single column", async () => {
      routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, {
          data: makeBoard([makeColumn("c-1", "To Do", 0, [])]),
        }),
      });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("button", { name: "Rename column: To Do" });
      expect(screen.queryByRole("button", { name: /Reorder column/ })).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // B2: card kebab menu — handleDuplicateCard and handleDeleteCard integration
  // ---------------------------------------------------------------------------
  describe("B2: card kebab menu — BoardDetailView integration", () => {
    const CARD_POST = "POST /api/v1/columns/c-1/cards";
    const CARD_DELETE = "DELETE /api/v1/cards/card-1";

    beforeEach(() => {
      (showError as jest.Mock).mockReset();
      (showSuccess as jest.Mock).mockReset();
    });

    function boardWithCard() {
      return makeBoard([
        makeColumn("c-1", "To Do", 1, [
          makeCard("card-1", "c-1", "Write spec", 0),
        ]),
      ]);
    }

    // --- duplicate success (no labels) ---

    it("duplicate: appends the new card to the column and shows a success toast", async () => {
      routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: boardWithCard() }),
        [CARD_POST]: jsonResponse(201, {
          data: makeCard("card-99", "c-1", "Write spec", 1),
        }),
      });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("button", { name: "Open card: Write spec" });

      await userEvent.click(screen.getByRole("button", { name: "Card actions for Write spec" }));
      await userEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));

      await waitFor(() => expect(showSuccess).toHaveBeenCalledWith("Task duplicated"));
      expect(screen.getAllByText("Write spec")).toHaveLength(2);
    });

    // --- duplicate success with labels ---

    it("duplicate: applies labels after creating the card and shows success toast", async () => {
      const cardWithLabel = {
        ...makeCard("card-1", "c-1", "Write spec", 0),
        labels: [{ id: "l-1", name: "Bug", color: "red" }],
      };
      const board = makeBoard([makeColumn("c-1", "To Do", 1, [cardWithLabel])]);

      const createdCard = makeCard("card-99", "c-1", "Write spec", 1);
      const labeledCard = {
        ...createdCard,
        labels: [{ id: "l-1", name: "Bug", color: "red" }],
      };

      routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: board }),
        [CARD_POST]: jsonResponse(201, { data: createdCard }),
        "PUT /api/v1/cards/card-99/labels": jsonResponse(200, { data: labeledCard }),
      });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("button", { name: "Open card: Write spec" });

      await userEvent.click(screen.getByRole("button", { name: "Card actions for Write spec" }));
      await userEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));

      await waitFor(() => expect(showSuccess).toHaveBeenCalledWith("Task duplicated"));
    });

    // --- duplicate label-failure warning path ---

    it("duplicate: shows error toast and keeps the card when label PUT fails", async () => {
      const cardWithLabel = {
        ...makeCard("card-1", "c-1", "Write spec", 0),
        labels: [{ id: "l-1", name: "Bug", color: "red" }],
      };
      const board = makeBoard([makeColumn("c-1", "To Do", 1, [cardWithLabel])]);

      routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: board }),
        [CARD_POST]: jsonResponse(201, { data: makeCard("card-99", "c-1", "Write spec", 1) }),
        "PUT /api/v1/cards/card-99/labels": errorResponse(500, "INTERNAL_ERROR", "labels failed"),
      });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("button", { name: "Open card: Write spec" });

      await userEvent.click(screen.getByRole("button", { name: "Card actions for Write spec" }));
      await userEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));

      await waitFor(() =>
        expect(showError).toHaveBeenCalledWith(
          "Card duplicated, but labels could not be copied.",
        ),
      );
      // Success toast must NOT be shown when labels fail
      expect(showSuccess).not.toHaveBeenCalled();
      // Card was still optimistically added
      expect(screen.getAllByText("Write spec")).toHaveLength(2);
    });

    // --- delete via kebab ---

    it("delete: removes the card from the board after confirmation", async () => {
      routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: boardWithCard() }),
        [CARD_DELETE]: noContent(),
      });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("button", { name: "Open card: Write spec" });

      await userEvent.click(screen.getByRole("button", { name: "Card actions for Write spec" }));
      await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent("Write spec");
      await userEvent.click(within(dialog).getByRole("button", { name: "Confirm delete" }));

      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "Open card: Write spec" })).not.toBeInTheDocument(),
      );
    });

    // --- duplicate: correct column state ---

    it("duplicate: appends the new card only to the source column, not to other columns", async () => {
      const twoColBoard = makeBoard([
        makeColumn("c-1", "To Do", 1, [makeCard("card-1", "c-1", "Write spec", 0)]),
        makeColumn("c-2", "Done", 2, [makeCard("card-2", "c-2", "Ship it", 0)]),
      ]);
      routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: twoColBoard }),
        [CARD_POST]: jsonResponse(201, {
          data: makeCard("card-99", "c-1", "Write spec", 1),
        }),
      });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("button", { name: "Open card: Write spec" });

      await userEvent.click(screen.getByRole("button", { name: "Card actions for Write spec" }));
      await userEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));

      await waitFor(() => expect(showSuccess).toHaveBeenCalledWith("Task duplicated"));

      // The source column now shows two "Write spec" cards.
      const todo = screen.getByRole("listitem", { name: "To Do" });
      expect(within(todo).getAllByText("Write spec")).toHaveLength(2);

      // The other column is unchanged.
      const done = screen.getByRole("listitem", { name: "Done" });
      expect(within(done).queryByText("Write spec")).not.toBeInTheDocument();
      expect(within(done).getByText("Ship it")).toBeInTheDocument();
    });

    // --- delete: correct column state ---

    it("delete: removes only the targeted card and leaves other cards intact", async () => {
      const boardWithTwo = makeBoard([
        makeColumn("c-1", "To Do", 1, [
          makeCard("card-1", "c-1", "Write spec", 0),
          makeCard("card-5", "c-1", "Plan sprint", 1),
        ]),
      ]);
      routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: boardWithTwo }),
        [CARD_DELETE]: noContent(),
      });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("button", { name: "Open card: Write spec" });

      await userEvent.click(screen.getByRole("button", { name: "Card actions for Write spec" }));
      await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
      const dialog = await screen.findByRole("dialog");
      await userEvent.click(within(dialog).getByRole("button", { name: "Confirm delete" }));

      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "Open card: Write spec" })).not.toBeInTheDocument(),
      );
      // The sibling card must still be present.
      expect(screen.getByRole("button", { name: "Open card: Plan sprint" })).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // C2: 'Add New' split button in the board header
  // ---------------------------------------------------------------------------
  describe("C2: Add New split button", () => {
    beforeEach(() => {
      (showError as jest.Mock).mockReset();
    });

    it("renders the split button with correct roles and accessible names", async () => {
      routeFetch(fetchMock, { [BOARD_GET]: jsonResponse(200, { data: twoColumns() }) });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("listitem", { name: "To Do" });

      const group = screen.getByRole("group", { name: "Add new" });
      expect(group).toBeInTheDocument();
      const left = within(group).getByRole("button", { name: "Add new task" });
      expect(left).toBeInTheDocument();
      const right = within(group).getByRole("button", { name: "Open add new menu" });
      expect(right).toHaveAttribute("aria-haspopup", "menu");
      expect(right).toHaveAttribute("aria-expanded", "false");
    });

    it("left click with no columns: toasts, no form opened, no POST", async () => {
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: makeBoard([]) }),
      });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByText(/this board has no columns yet/i);

      await userEvent.click(screen.getByRole("button", { name: "Add new task" }));

      expect(showError).toHaveBeenCalledWith("Create a column first");
      expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
      expect(screen.queryByLabelText("Card title")).not.toBeInTheDocument();
    });

    it("left click with columns opens AddCardForm in the first column", async () => {
      routeFetch(fetchMock, { [BOARD_GET]: jsonResponse(200, { data: twoColumns() }) });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("listitem", { name: "To Do" });

      await userEvent.click(screen.getByRole("button", { name: "Add new task" }));

      const todo = screen.getByRole("listitem", { name: "To Do" });
      const input = within(todo).getByLabelText("Card title");
      expect(input).toBeInTheDocument();
      expect(input).toHaveFocus();
      expect(within(todo).queryByRole("button", { name: "Add card to To Do" })).not.toBeInTheDocument();
      const done = screen.getByRole("listitem", { name: "Done" });
      expect(within(done).getByRole("button", { name: "Add card to Done" })).toBeInTheDocument();
    });

    it("menu 'New Task' triggers the same action as the left click", async () => {
      routeFetch(fetchMock, { [BOARD_GET]: jsonResponse(200, { data: twoColumns() }) });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("listitem", { name: "To Do" });

      await userEvent.click(screen.getByRole("button", { name: "Open add new menu" }));
      await userEvent.click(screen.getByRole("menuitem", { name: "New Task" }));

      const todo = screen.getByRole("listitem", { name: "To Do" });
      expect(within(todo).getByLabelText("Card title")).toBeInTheDocument();
      expect(within(todo).queryByRole("button", { name: "Add card to To Do" })).not.toBeInTheDocument();
    });

    it("menu 'New Column' opens the column creation flow", async () => {
      const calls = routeFetch(fetchMock, {
        [BOARD_GET]: jsonResponse(200, { data: makeBoard([]) }),
        "POST /api/boards/b-1/columns": jsonResponse(201, {
          data: { ...makeColumn("c-9", "Backlog", 1, []), cards: undefined },
        }),
      });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByText(/this board has no columns yet/i);

      await userEvent.click(screen.getByRole("button", { name: "Open add new menu" }));
      await userEvent.click(screen.getByRole("menuitem", { name: "New Column" }));

      expect(screen.getByLabelText("Column name")).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText("Column name"), "Backlog");
      await userEvent.click(screen.getByRole("button", { name: "Create column" }));

      expect(await screen.findByRole("listitem", { name: "Backlog" })).toBeInTheDocument();
      expect(calls.find((c) => c.method === "POST")?.body).toEqual({ name: "Backlog" });
    });

    it("keyboard: Tab between parts, Enter opens, arrows navigate, Escape closes and refocuses", async () => {
      routeFetch(fetchMock, { [BOARD_GET]: jsonResponse(200, { data: twoColumns() }) });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("listitem", { name: "To Do" });

      const left = screen.getByRole("button", { name: "Add new task" });
      const right = screen.getByRole("button", { name: "Open add new menu" });

      // Tab from the left button lands on the right button.
      left.focus();
      await userEvent.tab();
      expect(right).toHaveFocus();

      // Enter opens the dropdown; first item is focused.
      await userEvent.keyboard("{Enter}");
      expect(right).toHaveAttribute("aria-expanded", "true");
      const menu = screen.getByRole("menu", { name: "Open add new menu" });
      const firstItem = within(menu).getByRole("menuitem", { name: "New Task" });
      expect(firstItem).toHaveFocus();
      expect(within(menu).getByRole("menuitem", { name: "New Column" })).toBeInTheDocument();

      // ArrowDown moves to the second item.
      await userEvent.keyboard("{ArrowDown}");
      expect(within(menu).getByRole("menuitem", { name: "New Column" })).toHaveFocus();
      // ArrowUp moves back to the first.
      await userEvent.keyboard("{ArrowUp}");
      expect(firstItem).toHaveFocus();

      // Escape closes the menu and returns focus to the trigger.
      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("menu", { name: "Open add new menu" })).not.toBeInTheDocument();
      expect(right).toHaveFocus();
      expect(right).toHaveAttribute("aria-expanded", "false");
    });

    it("keyboard: menu item Enter triggers the action", async () => {
      routeFetch(fetchMock, { [BOARD_GET]: jsonResponse(200, { data: twoColumns() }) });
      render(<BoardDetailView boardId="b-1" />);
      await screen.findByRole("listitem", { name: "To Do" });

      const right = screen.getByRole("button", { name: "Open add new menu" });
      right.focus();
      await userEvent.keyboard("{Enter}");
      const menu = screen.getByRole("menu", { name: "Open add new menu" });
      const firstItem = within(menu).getByRole("menuitem", { name: "New Task" });
      firstItem.focus();
      await userEvent.keyboard("{Enter}");

      const todo = screen.getByRole("listitem", { name: "To Do" });
      expect(within(todo).getByLabelText("Card title")).toBeInTheDocument();
    });
  });
});
