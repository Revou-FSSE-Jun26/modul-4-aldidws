import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyTasksList } from "@/components/board/MyTasksList";
import { useAuth } from "@/context/AuthContext";
import { errorResponse, jsonResponse, routeFetch } from "@/tests/fetchRoutes";

const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace, push: jest.fn() };
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/my-tasks",
}));
jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));

const fetchMock = jest.fn();
const stamp = "2026-01-01T00:00:00Z";

function item(id: string, title: string, boardId: string, boardName: string, columnName: string) {
  return {
    id,
    column_id: "c-1",
    owner_id: "u-1",
    title,
    description: null,
    order: 0,
    due_date: null,
    priority: null,
    labels: [],
    deleted_at: null,
    created_at: stamp,
    updated_at: stamp,
    board_id: boardId,
    board_name: boardName,
    column_name: columnName,
  };
}

const URL1 = "GET /api/v1/cards?mine=true&page=1&per_page=50";

describe("MyTasksList", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    (useAuth as jest.Mock).mockReturnValue({ token: "tok", isLoading: false });
  });

  it("groups cards by board with links and column badges", async () => {
    routeFetch(fetchMock, {
      [URL1]: jsonResponse(200, {
        data: [
          item("1", "Write spec", "b-1", "Alpha", "To Do"),
          item("2", "Ship it", "b-1", "Alpha", "Done"),
          item("3", "Plan trip", "b-2", "Beta", "Ideas"),
        ],
        meta: { page: 1, per_page: 50, total: 3 },
      }),
    });
    render(<MyTasksList />);

    const alpha = await screen.findByRole("region", { name: "Alpha" });
    expect(within(alpha).getByRole("link", { name: "Alpha" })).toHaveAttribute("href", "/boards/b-1");
    expect(within(alpha).getByRole("link", { name: "Write spec" })).toHaveAttribute("href", "/boards/b-1");
    expect(within(alpha).getByText("Done")).toBeInTheDocument();
    const beta = screen.getByRole("region", { name: "Beta" });
    expect(within(beta).getByText("Plan trip")).toBeInTheDocument();
    expect(within(beta).queryByText("Write spec")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("shows an Overdue badge for a past due date and none without a date", async () => {
    routeFetch(fetchMock, {
      [URL1]: jsonResponse(200, {
        data: [
          { ...item("1", "Late task", "b-1", "Alpha", "To Do"), due_date: "2020-01-01T00:00:00Z" },
          item("2", "No date task", "b-1", "Alpha", "To Do"),
        ],
        meta: { page: 1, per_page: 50, total: 2 },
      }),
    });
    render(<MyTasksList />);
    const alpha = await screen.findByRole("region", { name: "Alpha" });
    const rows = within(alpha).getAllByRole("listitem");
    expect(within(rows[0]).getByText("Overdue")).toBeInTheDocument();
    expect(within(rows[1]).queryByText("Overdue")).not.toBeInTheDocument();
  });

  it("shows the names of all labels of a task", async () => {
    routeFetch(fetchMock, {
      [URL1]: jsonResponse(200, {
        data: [
          {
            ...item("1", "Tagged task", "b-1", "Alpha", "To Do"),
            labels: [
              { id: "l-1", name: "Bug", color: "red" },
              { id: "l-2", name: "Docs", color: "blue" },
            ],
          },
        ],
        meta: { page: 1, per_page: 50, total: 1 },
      }),
    });
    render(<MyTasksList />);
    const alpha = await screen.findByRole("region", { name: "Alpha" });
    expect(within(alpha).getByText("Bug")).toBeInTheDocument();
    expect(within(alpha).getByText("Docs")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    routeFetch(fetchMock, {
      [URL1]: jsonResponse(200, { data: [], meta: { page: 1, per_page: 50, total: 0 } }),
    });
    render(<MyTasksList />);
    expect(await screen.findByText(/haven't created any cards yet/i)).toBeInTheDocument();
  });

  it.each([404, 405, 500])("shows a real error (not an empty state) on %i", async (status) => {
    routeFetch(fetchMock, { [URL1]: errorResponse(status, "X", "Request failed badly") });
    render(<MyTasksList />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Request failed badly");
    expect(screen.queryByText(/haven't created any cards yet/i)).not.toBeInTheDocument();
  });

  it("retries after an error", async () => {
    routeFetch(fetchMock, { [URL1]: errorResponse(500, "X", "Down") });
    render(<MyTasksList />);
    await screen.findByRole("alert");
    routeFetch(fetchMock, {
      [URL1]: jsonResponse(200, {
        data: [item("1", "Write spec", "b-1", "Alpha", "To Do")],
        meta: { page: 1, per_page: 50, total: 1 },
      }),
    });
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Write spec")).toBeInTheDocument();
  });

  it("loads the next page with Load more", async () => {
    const calls = routeFetch(fetchMock, {
      [URL1]: jsonResponse(200, {
        data: [item("1", "First", "b-1", "Alpha", "To Do")],
        meta: { page: 1, per_page: 50, total: 51 },
      }),
      "GET /api/v1/cards?mine=true&page=2&per_page=50": jsonResponse(200, {
        data: [item("2", "Second", "b-1", "Alpha", "To Do")],
        meta: { page: 2, per_page: 50, total: 51 },
      }),
    });
    render(<MyTasksList />);
    await userEvent.click(await screen.findByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Second")).toBeInTheDocument();
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(calls).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("redirects to /login?next= on 401", async () => {
    routeFetch(fetchMock, { [URL1]: errorResponse(401, "UNAUTHORIZED", "no") });
    render(<MyTasksList />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login?next=%2Fmy-tasks"));
  });

  it("redirects to login and sends no request without a token", () => {
    (useAuth as jest.Mock).mockReturnValue({ token: null, isLoading: false });
    render(<MyTasksList />);
    expect(mockReplace).toHaveBeenCalledWith("/login?next=%2Fmy-tasks");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
