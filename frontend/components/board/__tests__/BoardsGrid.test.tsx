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
  usePathname: () => "/",
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
    mockUseAuth.mockReturnValue({ token: null, isAuthLoading: true });
    render(<BoardsGrid />);
    expect(screen.getByLabelText(/loading boards/i)).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirects to /login after auth finishes loading without a token", () => {
    mockUseAuth.mockReturnValue({ token: null, isAuthLoading: false });
    render(<BoardsGrid />);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sends the Authorization header and renders boards", async () => {
    mockUseAuth.mockReturnValue({ token: "test-token", isAuthLoading: false });
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [board] }));
    render(<BoardsGrid />);

    expect(
      await screen.findByRole("link", { name: "Board A" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toEqual(expect.stringContaining("/api/boards"));
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows the empty state when there are no boards", async () => {
    mockUseAuth.mockReturnValue({ token: "test-token", isAuthLoading: false });
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [] }));
    render(<BoardsGrid />);
    expect(
      await screen.findByText(/No boards yet/i),
    ).toBeInTheDocument();
  });

  it("shows an alert on a server error without redirecting", async () => {
    mockUseAuth.mockReturnValue({ token: "test-token", isAuthLoading: false });
    fetchMock.mockResolvedValue(jsonResponse(500, {}));
    render(<BoardsGrid />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/status 500/i);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows an alert on a network failure", async () => {
    mockUseAuth.mockReturnValue({ token: "test-token", isAuthLoading: false });
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<BoardsGrid />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not load boards/i,
    );
  });

  it("redirects to /login when the API returns 401", async () => {
    mockUseAuth.mockReturnValue({ token: "expired", isAuthLoading: false });
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    render(<BoardsGrid />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  // Rewritten: boards are now real links (accessible name = board name) rather
  // than "Open card" buttons that call router.push, so the click test checks the href.
  it("renders each board as a link to its detail page", async () => {
    mockUseAuth.mockReturnValue({ token: "test-token", isAuthLoading: false });
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [board] }));
    render(<BoardsGrid />);
    const link = await screen.findByRole("link", { name: "Board A" });
    expect(link).toHaveAttribute("href", "/boards/b-1");
  });

  it("mounts the create-board form, also when there are no boards", async () => {
    mockUseAuth.mockReturnValue({ token: "test-token", isAuthLoading: false });
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [] }));
    render(<BoardsGrid />);
    expect(
      await screen.findByRole("button", { name: "Create board" }),
    ).toBeInTheDocument();
  });

  it("creates a board with exactly {name} and shows it as a link", async () => {
    mockUseAuth.mockReturnValue({ token: "test-token", isAuthLoading: false });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));
    render(<BoardsGrid />);
    await userEvent.click(await screen.findByRole("button", { name: "Create board" }));
    await userEvent.type(screen.getByLabelText("Board name"), "  Roadmap ");
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, { data: { ...board, id: "b-2", name: "Roadmap" } }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("link", { name: "Roadmap" })).toHaveAttribute(
      "href",
      "/boards/b-2",
    );
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toEqual(expect.stringContaining("/api/boards"));
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ name: "Roadmap" });
    expect(screen.getByRole("status")).toHaveTextContent("Board created");
  });
});