import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardsGrid } from "@/components/board/BoardsGrid";
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
  name: "Board A",
  user_id: "u-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};

describe("BoardsGrid", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockPush.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("shows loading state and does not redirect or fetch while auth loads", () => {
    mockUseAuth.mockReturnValue({ token: null, isLoading: true });
    render(<BoardsGrid />);
    expect(screen.getByLabelText(/loading boards/i)).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirects to /login after auth finishes loading without a token", () => {
    mockUseAuth.mockReturnValue({ token: null, isLoading: false });
    render(<BoardsGrid />);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sends the Authorization header and renders boards", async () => {
    mockUseAuth.mockReturnValue({ token: "test-token", isLoading: false });
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [board] }));
    render(<BoardsGrid />);

    expect(
      await screen.findByRole("button", { name: /open card: board a/i }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toEqual(expect.stringContaining("/api/boards"));
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows the empty state when there are no boards", async () => {
    mockUseAuth.mockReturnValue({ token: "test-token", isLoading: false });
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [] }));
    render(<BoardsGrid />);
    expect(
      await screen.findByText(/don't have any boards yet/i),
    ).toBeInTheDocument();
  });

  it("shows an alert on a server error without redirecting", async () => {
    mockUseAuth.mockReturnValue({ token: "test-token", isLoading: false });
    fetchMock.mockResolvedValue(jsonResponse(500, {}));
    render(<BoardsGrid />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/status 500/i);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows an alert on a network failure", async () => {
    mockUseAuth.mockReturnValue({ token: "test-token", isLoading: false });
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<BoardsGrid />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not load boards/i,
    );
  });

  it("redirects to /login when the API returns 401", async () => {
    mockUseAuth.mockReturnValue({ token: "expired", isLoading: false });
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    render(<BoardsGrid />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  it("navigates to the board detail when a board is clicked", async () => {
    mockUseAuth.mockReturnValue({ token: "test-token", isLoading: false });
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [board] }));
    render(<BoardsGrid />);
    await userEvent.click(
      await screen.findByRole("button", { name: /open card: board a/i }),
    );
    expect(mockPush).toHaveBeenCalledWith("/boards/b-1");
  });
});
