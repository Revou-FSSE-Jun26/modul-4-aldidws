import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchBar } from "@/components/board/SearchBar";
import { useAuth } from "@/context/AuthContext";
import { jsonResponse, routeFetch, errorResponse } from "@/tests/fetchRoutes";

jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));

const fetchMock = jest.fn();
const stamp = "2026-01-01T00:00:00Z";

function item(id: string, title: string) {
  return {
    id,
    column_id: "c-1",
    owner_id: "u-1",
    title,
    description: null,
    order: 0,
    deleted_at: null,
    created_at: stamp,
    updated_at: stamp,
    board_id: "b-1",
    board_name: "Board One",
    column_name: "To Do",
  };
}

const page = (data: unknown[]) => ({ data, meta: { page: 1, per_page: 20, total: data.length } });

describe("SearchBar", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    (useAuth as jest.Mock).mockReturnValue({ token: "tok" });
  });

  it("sends no request for an empty query", async () => {
    const calls = routeFetch(fetchMock, {});
    render(<SearchBar onSelect={jest.fn()} />);
    await userEvent.type(screen.getByLabelText("Search cards"), "   ");
    await new Promise((r) => setTimeout(r, 400));
    expect(calls).toHaveLength(0);
  });

  it("caps the query at 100 characters", () => {
    routeFetch(fetchMock, {});
    render(<SearchBar onSelect={jest.fn()} />);
    expect(screen.getByLabelText("Search cards")).toHaveAttribute("maxlength", "100");
  });

  it("debounces typing into one request and passes the board id", async () => {
    const calls = routeFetch(fetchMock, {
      "GET /api/v1/cards?search=spec&board_id=b-1&per_page=20": jsonResponse(
        200,
        page([item("card-1", "Write spec")]),
      ),
    });
    render(<SearchBar boardId="b-1" onSelect={jest.fn()} />);
    await userEvent.type(screen.getByLabelText("Search cards"), "spec");
    expect(await screen.findByRole("button", { name: /write spec/i })).toBeInTheDocument();
    expect(calls).toHaveLength(1);
    expect(calls[0].headers.Authorization).toBe("Bearer tok");
  });

  it("encodes special characters in the query string", async () => {
    const calls = routeFetch(fetchMock, {
      "GET /api/v1/cards?search=50%25+%26+up&per_page=20": jsonResponse(200, page([])),
    });
    render(<SearchBar onSelect={jest.fn()} />);
    await userEvent.type(screen.getByLabelText("Search cards"), "50% & up");
    expect(await screen.findByText("No cards match.")).toBeInTheDocument();
    expect(calls).toHaveLength(1);
  });

  it("shows an empty-results message", async () => {
    routeFetch(fetchMock, { "GET /api/v1/cards?search=zzz&per_page=20": jsonResponse(200, page([])) });
    render(<SearchBar onSelect={jest.fn()} />);
    await userEvent.type(screen.getByLabelText("Search cards"), "zzz");
    expect(await screen.findByText("No cards match.")).toBeInTheDocument();
  });

  it("shows an error from the server instead of an empty list", async () => {
    routeFetch(fetchMock, {
      "GET /api/v1/cards?search=boom&per_page=20": errorResponse(500, "INTERNAL_ERROR", "Server broke"),
    });
    render(<SearchBar onSelect={jest.fn()} />);
    await userEvent.type(screen.getByLabelText("Search cards"), "boom");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("No cards match.")).not.toBeInTheDocument();
  });

  it("calls onSelect with the picked card", async () => {
    routeFetch(fetchMock, {
      "GET /api/v1/cards?search=spec&per_page=20": jsonResponse(200, page([item("card-1", "Write spec")])),
    });
    const onSelect = jest.fn();
    render(<SearchBar onSelect={onSelect} />);
    await userEvent.type(screen.getByLabelText("Search cards"), "spec");
    await userEvent.click(await screen.findByRole("button", { name: /write spec/i }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "card-1" }));
  });

  it("ignores a stale response that arrives after a newer one", async () => {
    const resolvers: Record<string, (r: unknown) => void> = {};
    fetchMock.mockImplementation(
      (url: string) =>
        new Promise((resolve) => {
          resolvers[String(url).replace(/^https?:\/\/[^/]+/, "")] = resolve;
        }),
    );
    render(<SearchBar onSelect={jest.fn()} />);
    const input = screen.getByLabelText("Search cards");
    await userEvent.type(input, "a");
    await waitFor(() => expect(resolvers["/api/v1/cards?search=a&per_page=20"]).toBeDefined());
    await userEvent.type(input, "b");
    await waitFor(() => expect(resolvers["/api/v1/cards?search=ab&per_page=20"]).toBeDefined());

    resolvers["/api/v1/cards?search=ab&per_page=20"](
      jsonResponse(200, page([item("card-2", "New result")])),
    );
    expect(await screen.findByRole("button", { name: /new result/i })).toBeInTheDocument();
    resolvers["/api/v1/cards?search=a&per_page=20"](
      jsonResponse(200, page([item("card-1", "Old result")])),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("button", { name: /old result/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new result/i })).toBeInTheDocument();
  });
});
