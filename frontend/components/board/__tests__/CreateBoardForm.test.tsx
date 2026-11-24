import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateBoardForm } from "@/components/board/CreateBoardForm";
import { useAuth } from "@/context/AuthContext";
import { errorResponse, jsonResponse, routeFetch } from "@/tests/fetchRoutes";

jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));

const fetchMock = jest.fn();
const created = {
  id: "b-2",
  name: "Roadmap",
  user_id: "u-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

async function openForm() {
  await userEvent.click(screen.getByRole("button", { name: "Create board" }));
  return screen.getByLabelText("Board name");
}

describe("CreateBoardForm", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    (useAuth as jest.Mock).mockReturnValue({ token: "tok" });
  });

  it("posts exactly {name} (trimmed) and reports the created board", async () => {
    const calls = routeFetch(fetchMock, { "POST /api/boards": jsonResponse(201, { data: created }) });
    const onCreated = jest.fn();
    render(<CreateBoardForm onCreated={onCreated} />);
    await userEvent.type(await openForm(), "  Roadmap  ");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Board created");
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(calls[0].body).toEqual({ name: "Roadmap" });
    expect(calls[0].headers.Authorization).toBe("Bearer tok");
    expect(screen.getByRole("button", { name: "Create board" })).toBeInTheDocument();
  });

  it("blocks a blank name and sends nothing", async () => {
    const calls = routeFetch(fetchMock, {});
    render(<CreateBoardForm onCreated={jest.fn()} />);
    await openForm();
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/required/i);
    expect(calls).toHaveLength(0);
  });

  it("shows the server message on 409 and keeps the typed name", async () => {
    routeFetch(fetchMock, {
      "POST /api/boards": errorResponse(409, "RESOURCE_CONFLICT", "A board with that name already exists."),
    });
    const onCreated = jest.fn();
    render(<CreateBoardForm onCreated={onCreated} />);
    await userEvent.type(await openForm(), "Roadmap");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A board with that name already exists.",
    );
    expect(screen.getByLabelText("Board name")).toHaveValue("Roadmap");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("shows the field error from a 400 response", async () => {
    routeFetch(fetchMock, {
      "POST /api/boards": errorResponse(400, "VALIDATION_ERROR", "bad", { name: ["Unknown field."] }),
    });
    render(<CreateBoardForm onCreated={jest.fn()} />);
    await userEvent.type(await openForm(), "X");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unknown field.");
  });

  it("cancel closes the form without a request", async () => {
    const calls = routeFetch(fetchMock, {});
    render(<CreateBoardForm onCreated={jest.fn()} />);
    await openForm();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Create board" })).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});
