import { render, screen, waitFor } from "@testing-library/react";
import { BoardDetailView } from "@/components/board/BoardDetailView";
import { useAuth } from "@/context/AuthContext";

const mockReplace = jest.fn();
const mockPush = jest.fn();
// Stable object, like the real useRouter(), so effects do not re-run each render.
const mockRouter = { replace: mockReplace, push: mockPush };

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));
jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
const fetchMock = jest.fn();

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const board = {
  id: "b-1",
  name: "Board One",
  user_id: "u-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};

const column = {
  id: "c-1",
  board_id: "b-1",
  name: "To Do",
  position: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

/** Routes the mocked fetch by URL; unspecified endpoints return 405. */
function routeFetch(routes: {
  board?: ReturnType<typeof jsonResponse>;
  columns?: ReturnType<typeof jsonResponse>;
  cards?: ReturnType<typeof jsonResponse>;
}) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes("/columns")) return routes.columns ?? jsonResponse(405, {});
    if (url.includes("/api/v1/cards"))
      return routes.cards ?? jsonResponse(405, {});
    return routes.board ?? jsonResponse(200, { data: board });
  });
}

describe("BoardDetailView", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("shows loading state and does not redirect or fetch while auth loads", () => {
    mockUseAuth.mockReturnValue({ token: null, isLoading: true });
    render(<BoardDetailView boardId="b-1" />);
    expect(screen.getByLabelText(/loading board/i)).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirects to /login after auth finishes loading without a token", () => {
    mockUseAuth.mockReturnValue({ token: null, isLoading: false });
    render(<BoardDetailView boardId="b-1" />);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the Authorization header and renders the board name", async () => {
    mockUseAuth.mockReturnValue({ token: "test-token", isLoading: false });
    routeFetch({});
    render(<BoardDetailView boardId="b-1" />);

    expect(
      await screen.findByRole("heading", { name: "Board One" }),
    ).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toEqual(expect.stringContaining("/api/boards/b-1"));
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows the empty state when the columns endpoint is unavailable", async () => {
    mockUseAuth.mockReturnValue({ token: "test-token", isLoading: false });
    routeFetch({});
    render(<BoardDetailView boardId="b-1" />);
    expect(
      await screen.findByText(/this board has no columns yet/i),
    ).toBeInTheDocument();
  });

  it("lists a column with no cards", async () => {
    mockUseAuth.mockReturnValue({ token: "test-token", isLoading: false });
    routeFetch({ columns: jsonResponse(200, { data: [column] }) });
    render(<BoardDetailView boardId="b-1" />);
    expect(
      await screen.findByRole("listitem", { name: "To Do" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no cards in this column/i)).toBeInTheDocument();
  });

  it("shows a not-found alert when the board returns 404", async () => {
    mockUseAuth.mockReturnValue({ token: "test-token", isLoading: false });
    routeFetch({ board: jsonResponse(404, {}) });
    render(<BoardDetailView boardId="b-1" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /board not found/i,
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows an alert when the board request fails with 500", async () => {
    mockUseAuth.mockReturnValue({ token: "test-token", isLoading: false });
    routeFetch({ board: jsonResponse(500, {}) });
    render(<BoardDetailView boardId="b-1" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/status 500/i);
  });

  it("shows an alert on a network failure", async () => {
    mockUseAuth.mockReturnValue({ token: "test-token", isLoading: false });
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<BoardDetailView boardId="b-1" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not load this board/i,
    );
  });

  it("redirects to /login when the API returns 401", async () => {
    mockUseAuth.mockReturnValue({ token: "expired", isLoading: false });
    routeFetch({ board: jsonResponse(401, {}) });
    render(<BoardDetailView boardId="b-1" />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });
});
