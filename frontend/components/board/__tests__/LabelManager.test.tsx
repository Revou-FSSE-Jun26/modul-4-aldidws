import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { CardDetailModal } from "@/components/board/CardDetailModal";
import { LabelManager } from "@/components/board/LabelManager";
import { useAuth } from "@/context/AuthContext";
import type { Card, Label } from "@/lib/types/api";
import {
  errorResponse,
  jsonResponse,
  noContent,
  routeFetch,
  type RouteHandler,
} from "@/tests/fetchRoutes";

jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));

const fetchMock = jest.fn();
const stamp = "2026-01-01T00:00:00Z";
const bug: Label = { id: "l-1", board_id: "b-1", name: "Bug", color: "red", created_at: stamp, updated_at: stamp };
const docs: Label = { id: "l-2", board_id: "b-1", name: "Docs", color: "blue", created_at: stamp, updated_at: stamp };

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  (useAuth as jest.Mock).mockReturnValue({
    token: "tok",
    currentUser: { id: "u-1", email: "a@b.co", name: "Ann", role: "user", timezone: "UTC" },
  });
});

describe("LabelManager", () => {
  function setup(routes: Record<string, RouteHandler> = {}) {
    const calls = routeFetch(fetchMock, routes);
    const onChanged = jest.fn();
    const onRequestDelete = jest.fn();
    render(
      <LabelManager
        boardId="b-1"
        labels={[bug, docs]}
        onChanged={onChanged}
        onRequestDelete={onRequestDelete}
      />,
    );
    return { calls, onChanged, onRequestDelete };
  }

  it("creates a label with exactly {name, color} and reloads", async () => {
    const { calls, onChanged } = setup({
      "POST /api/boards/b-1/labels": jsonResponse(201, { data: { ...bug, id: "l-9", name: "New" } }),
    });
    await userEvent.type(screen.getByLabelText("New label name"), "  New  ");
    await userEvent.click(within(screen.getAllByRole("radiogroup")[0]).getByLabelText("Green"));
    await userEvent.click(screen.getByRole("button", { name: "Create label" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(calls[0].body).toEqual({ name: "New", color: "green" });
    expect(screen.getByLabelText("New label name")).toHaveValue("");
  });

  it("rejects a blank name without a request", async () => {
    const { calls } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Create label" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Label name is required.");
    expect(calls).toHaveLength(0);
  });

  it("shows the 409 message and keeps the typed value", async () => {
    setup({
      "POST /api/boards/b-1/labels": errorResponse(409, "RESOURCE_CONFLICT", "dup"),
    });
    const input = screen.getByLabelText("New label name");
    await userEvent.type(input, "Bug");
    await userEvent.click(screen.getByRole("button", { name: "Create label" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A label with that name already exists.");
    expect(input).toHaveValue("Bug");
  });

  it("renames with exactly {name}", async () => {
    const { calls, onChanged } = setup({
      "PATCH /api/labels/l-1": jsonResponse(200, { data: { ...bug, name: "Defect" } }),
    });
    await userEvent.click(screen.getByRole("button", { name: "Edit label Bug" }));
    const input = screen.getByLabelText("Name of label Bug");
    await userEvent.clear(input);
    await userEvent.type(input, "Defect");
    await userEvent.click(screen.getByRole("button", { name: "Save label" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(calls[0].body).toEqual({ name: "Defect" });
  });

  it("recolours with exactly {color}", async () => {
    const { calls, onChanged } = setup({
      "PATCH /api/labels/l-1": jsonResponse(200, { data: { ...bug, color: "purple" } }),
    });
    await userEvent.click(screen.getByRole("button", { name: "Edit label Bug" }));
    const group = screen.getAllByRole("radiogroup")[0];
    await userEvent.click(within(group).getByLabelText("Purple"));
    await userEvent.click(screen.getByRole("button", { name: "Save label" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(calls[0].body).toEqual({ color: "purple" });
  });

  it("keeps the edit open and shows 409 on a clashing rename", async () => {
    setup({ "PATCH /api/labels/l-1": errorResponse(409, "RESOURCE_CONFLICT", "dup") });
    await userEvent.click(screen.getByRole("button", { name: "Edit label Bug" }));
    const input = screen.getByLabelText("Name of label Bug");
    await userEvent.clear(input);
    await userEvent.type(input, "docs");
    await userEvent.click(screen.getByRole("button", { name: "Save label" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A label with that name already exists.");
    expect(input).toHaveValue("docs");
  });

  it("asks the parent to confirm a delete", async () => {
    const { onRequestDelete } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Delete label Docs" }));
    expect(onRequestDelete).toHaveBeenCalledWith(docs);
  });
});

describe("label deletion inside the card dialog", () => {
  const card: Card = {
    id: "card-1",
    column_id: "c-1",
    owner_id: "u-1",
    title: "Write spec",
    description: "",
    order: 0,
    due_date: null,
    priority: null,
    labels: [{ id: "l-1", name: "Bug", color: "red" }],
    deleted_at: null,
    created_at: stamp,
    updated_at: stamp,
  };

  function Harness({ onLabelsChanged }: { onLabelsChanged: () => void }) {
    const [open] = useState(true);
    return (
      <CardDetailModal
        isOpen={open}
        onClose={jest.fn()}
        card={card}
        columns={[{ id: "c-1", name: "To Do", cards: [{ id: "card-1", order: 0 }] }]}
        onCardUpdated={jest.fn()}
        onCardDeleted={jest.fn()}
        onCardMoved={jest.fn()}
        boardId="b-1"
        boardLabels={[bug, docs]}
        labelUsage={{ "l-1": 2 }}
        onLabelsChanged={onLabelsChanged}
      />
    );
  }

  function setup(extra: Record<string, RouteHandler> = {}) {
    const calls = routeFetch(fetchMock, {
      "GET /api/cards/card-1/comments": jsonResponse(200, { data: [] }),
      ...extra,
    });
    const onLabelsChanged = jest.fn();
    render(<Harness onLabelsChanged={onLabelsChanged} />);
    return { calls, onLabelsChanged };
  }

  it("shows a confirmation with the title and card count, then cancel returns focus to Delete", async () => {
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "Delete label Bug" }));

    const dialog = await screen.findByRole("dialog", { name: 'Delete label "Bug"?' });
    expect(within(dialog).getByText("It will be removed from 2 cards.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Write spec" })).toBeNull();

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("dialog", { name: "Write spec" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Delete label Bug" })).toHaveFocus());
  });

  it("deletes after Confirm, reloads the board and focuses the section heading", async () => {
    const { onLabelsChanged, calls } = setup({ "DELETE /api/labels/l-1": noContent() });
    await userEvent.click(await screen.findByRole("button", { name: "Delete label Bug" }));
    const dialog = await screen.findByRole("dialog", { name: 'Delete label "Bug"?' });
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(onLabelsChanged).toHaveBeenCalledTimes(1));
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/labels/l-1")).toBe(true);
    const heading = await screen.findByRole("heading", { name: "Board labels" });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it("applies card labels with exactly {label_ids}", async () => {
    const { calls } = setup({
      "PUT /api/v1/cards/card-1/labels": jsonResponse(200, {
        data: { ...card, labels: [{ id: "l-2", name: "Docs", color: "blue" }] },
      }),
    });
    await userEvent.click(await screen.findByRole("button", { name: "Labels" }));
    await userEvent.keyboard("{ArrowDown} "); // add Docs
    await userEvent.keyboard("{Home} "); // remove Bug
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ label_ids: ["l-2"] });
  });
});
