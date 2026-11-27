import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { CardDetailModal } from "@/components/board/CardDetailModal";
import { useAuth } from "@/context/AuthContext";
import type { Card, Label, LabelColor } from "@/lib/types/api";
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

const card: Card = {
  id: "card-1",
  column_id: "c-1",
  owner_id: "u-1",
  title: "Write spec",
  description: "First draft",
  order: 0,
  due_date: null,
  priority: null,
  labels: [] as { id: string; name: string; color: LabelColor }[],
  deleted_at: null,
  created_at: stamp,
  updated_at: stamp,
};

const columns = [
  { id: "c-1", name: "To Do", cards: [{ id: "card-1", order: 0 }] },
  {
    id: "c-2",
    name: "Done",
    cards: [
      { id: "card-2", order: 1 },
      { id: "card-3", order: 3 },
    ],
  },
];

function apiComment(id: string, authorId: string, authorName: string, body: string, updated = stamp) {
  return {
    id,
    card_id: "card-1",
    author_id: authorId,
    author_name: authorName,
    body,
    created_at: stamp,
    updated_at: updated,
  };
}

const COMMENTS_GET = "GET /api/cards/card-1/comments";

interface SetupOptions {
  card?: typeof card;
  boardLabels?: Label[];
  labelUsage?: Record<string, number>;
}

function setup(routes: Record<string, RouteHandler> = {}, options: SetupOptions = {}) {
  const calls = routeFetch(fetchMock, {
    [COMMENTS_GET]: jsonResponse(200, {
      data: [
        apiComment("cm-1", "u-1", "Ann", "My note"),
        apiComment("cm-2", "u-2", "Bob", "Someone else"),
      ],
    }),
    ...routes,
  });
  const handlers = {
    onClose: jest.fn(),
    onCardUpdated: jest.fn(),
    onCardDeleted: jest.fn(),
    onCardMoved: jest.fn(),
    onLabelsChanged: jest.fn(),
  };
  render(
    <CardDetailModal
      isOpen
      card={options.card ?? card}
      columns={columns}
      boardId="b-1"
      boardLabels={options.boardLabels ?? []}
      labelUsage={options.labelUsage}
      {...handlers}
    />,
  );
  return { calls, ...handlers };
}

describe("CardDetailModal", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    (useAuth as jest.Mock).mockReturnValue({
      token: "tok",
      currentUser: { id: "u-1", email: "a@b.co", name: "Ann", role: "user", timezone: "UTC" },
    });
  });

  it("shows comments with author names, and edit/delete only on own comments", async () => {
    setup();
    expect(await screen.findByText("My note")).toBeInTheDocument();
    expect(screen.getByText("Ann")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    const items = screen.getAllByTestId("comment-item");
    expect(within(items[0]).getByRole("button", { name: "Edit comment" })).toBeInTheDocument();
    expect(within(items[1]).queryByRole("button", { name: "Edit comment" })).toBeNull();
    expect(within(items[1]).queryByRole("button", { name: "Delete comment" })).toBeNull();
  });

  it("shows the empty comment state", async () => {
    setup({ [COMMENTS_GET]: jsonResponse(200, { data: [] }) });
    expect(await screen.findByText(/no comments yet/i)).toBeInTheDocument();
  });

  it("shows an error when comments fail to load", async () => {
    setup({ [COMMENTS_GET]: errorResponse(500, "INTERNAL_ERROR", "boom") });
    expect(await screen.findByText(/status 500|boom|failed/i)).toBeInTheDocument();
  });

  it("posts a comment with exactly {body}", async () => {
    const { calls } = setup({
      "POST /api/cards/card-1/comments": jsonResponse(201, {
        data: apiComment("cm-3", "u-1", "Ann", "Fresh"),
      }),
    });
    await userEvent.type(await screen.findByLabelText("Add a comment"), "  Fresh ");
    await userEvent.click(screen.getByRole("button", { name: "Post comment" }));
    expect(await screen.findByText("Fresh")).toBeInTheDocument();
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ body: "Fresh" });
  });

  it("blocks a blank comment and sends nothing", async () => {
    const { calls } = setup();
    await userEvent.type(await screen.findByLabelText("Add a comment"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Post comment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot be empty/i);
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("edits an own comment with exactly {body} and shows the edited badge", async () => {
    const { calls } = setup({
      "PATCH /api/comments/cm-1": jsonResponse(200, {
        data: apiComment("cm-1", "u-1", "Ann", "My note v2", "2026-01-02T00:00:00Z"),
      }),
    });
    await userEvent.click(await screen.findByRole("button", { name: "Edit comment" }));
    const field = screen.getByLabelText("Edit comment text");
    await userEvent.clear(field);
    await userEvent.type(field, "My note v2");
    await userEvent.click(screen.getByRole("button", { name: "Save comment" }));

    expect(await screen.findByText("My note v2")).toBeInTheDocument();
    expect(screen.getByText("edited")).toBeInTheDocument();
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ body: "My note v2" });
  });

  it("keeps the editor open and shows the error when saving a comment fails", async () => {
    setup({
      "PATCH /api/comments/cm-1": errorResponse(403, "COMMENT_ACCESS_DENIED", "Not yours"),
    });
    await userEvent.click(await screen.findByRole("button", { name: "Edit comment" }));
    await userEvent.type(screen.getByLabelText("Edit comment text"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Save comment" }));
    expect(await screen.findByText("Not yours")).toBeInTheDocument();
    expect(screen.getByLabelText("Edit comment text")).toBeInTheDocument();
  });

  it("deletes an own comment", async () => {
    const { calls } = setup({ "DELETE /api/comments/cm-1": noContent() });
    await userEvent.click(await screen.findByRole("button", { name: "Delete comment" }));
    await waitFor(() => expect(screen.queryByText("My note")).not.toBeInTheDocument());
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/comments/cm-1")).toBe(true);
  });

  it("saves title and description with exactly {title, description}", async () => {
    const { calls, onCardUpdated } = setup({
      "PATCH /api/v1/cards/card-1": jsonResponse(200, {
        data: { ...card, title: "Write the spec", description: "Second draft" },
      }),
    });
    const title = await screen.findByLabelText("Card title");
    await userEvent.clear(title);
    await userEvent.type(title, "Write the spec");
    const description = screen.getByLabelText("Description");
    await userEvent.clear(description);
    await userEvent.type(description, "Second draft");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onCardUpdated).toHaveBeenCalledTimes(1));
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
      title: "Write the spec",
      description: "Second draft",
    });
    expect(screen.getByRole("status")).toHaveTextContent("Card saved");
  });

  it("rejects a blank title without calling the API", async () => {
    const { calls } = setup();
    const title = await screen.findByLabelText("Card title");
    await userEvent.clear(title);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
    expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(0);
  });

  it("moves the card to the end of another column with {column_id, order}", async () => {
    const { calls, onCardMoved } = setup({
      "PATCH /api/v1/cards/card-1/position": jsonResponse(200, {
        data: { ...card, column_id: "c-2", order: 4 },
      }),
    });
    await userEvent.selectOptions(await screen.findByLabelText("Move to column"), "c-2");
    await waitFor(() => expect(onCardMoved).toHaveBeenCalledTimes(1));
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
      column_id: "c-2",
      order: 4,
    });
  });

  it("shows an error when the move fails and does not report success", async () => {
    const { onCardMoved } = setup({
      "PATCH /api/v1/cards/card-1/position": errorResponse(404, "COLUMN_NOT_FOUND", "Column gone"),
    });
    await userEvent.selectOptions(await screen.findByLabelText("Move to column"), "c-2");
    expect(await screen.findByText("Column gone")).toBeInTheDocument();
    expect(onCardMoved).not.toHaveBeenCalled();
  });

  it("deletes the card only after confirmation", async () => {
    const { calls, onCardDeleted } = setup({
      "DELETE /api/v1/cards/card-1": noContent(),
    });
    await userEvent.click(await screen.findByRole("button", { name: "Delete card" }));
    expect(await screen.findByRole("dialog", { name: "Delete this card?" })).toBeInTheDocument();
    expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    await waitFor(() => expect(onCardDeleted).toHaveBeenCalledWith("card-1"));
  });

  it("cancelling the confirmation keeps the card and sends no request", async () => {
    const { calls, onCardDeleted } = setup();
    await userEvent.click(await screen.findByRole("button", { name: "Delete card" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByLabelText("Card title")).toBeInTheDocument();
    expect(onCardDeleted).not.toHaveBeenCalled();
    expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(0);
  });

  it("closes on Escape", async () => {
    const { onClose } = setup();
    await screen.findByText("My note");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("saves a due date with exactly {due_date: <UTC ISO>} and reports the updated card", async () => {
    const updated = { ...card, due_date: "2030-05-06T07:08:00Z" };
    const { calls, onCardUpdated } = setup({
      "PATCH /api/v1/cards/card-1": jsonResponse(200, { data: updated }),
    });
    await userEvent.type(await screen.findByLabelText("Due date"), "2030-05-06T07:08");
    await userEvent.click(screen.getByRole("button", { name: "Save due date" }));
    await waitFor(() => expect(onCardUpdated).toHaveBeenCalledWith(updated));
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch?.body).toEqual({
      due_date: new Date("2030-05-06T07:08").toISOString().slice(0, 19) + "Z",
    });
  });

  it("renders one due date field after saving on a card without labels (regression: duplicate keys)", async () => {
    const updated = { ...card, due_date: "2030-05-06T07:08:00Z" };
    routeFetch(fetchMock, {
      [COMMENTS_GET]: jsonResponse(200, { data: [] }),
      "PATCH /api/v1/cards/card-1": jsonResponse(200, { data: updated }),
    });
    function Harness() {
      const [current, setCurrent] = useState<Card>(card);
      return (
        <CardDetailModal
          isOpen
          card={current}
          columns={columns}
          onClose={jest.fn()}
          onCardUpdated={(c) => setCurrent((prev) => ({ ...prev, ...c }))}
          onCardDeleted={jest.fn()}
          onCardMoved={jest.fn()}
          boardId="b-1"
          boardLabels={[]}
          onLabelsChanged={jest.fn()}
        />
      );
    }
    render(<Harness />);
    await userEvent.type(await screen.findByLabelText("Due date"), "2030-05-06T07:08");
    await userEvent.click(screen.getByRole("button", { name: "Save due date" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove due date" })).toBeEnabled(),
    );
    expect(screen.getAllByLabelText("Due date")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Labels" })).toHaveLength(1);
  });

  it("removes the due date with exactly {due_date: null}", async () => {
    const withDate = { ...card, due_date: "2030-05-06T07:08:00Z" };
    const calls = routeFetch(fetchMock, {
      [COMMENTS_GET]: jsonResponse(200, { data: [] }),
      "PATCH /api/v1/cards/card-1": jsonResponse(200, { data: { ...card, due_date: null } }),
    });
    const onCardUpdated = jest.fn();
    render(
      <CardDetailModal
        isOpen
        card={withDate}
        columns={columns}
        onClose={jest.fn()}
        onCardUpdated={onCardUpdated}
        onCardDeleted={jest.fn()}
        onCardMoved={jest.fn()}
        boardId="b-1"
        boardLabels={[]}
        onLabelsChanged={jest.fn()}
      />,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Remove due date" }));
    await waitFor(() => expect(onCardUpdated).toHaveBeenCalled());
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ due_date: null });
  });

  it("keeps the typed due date and shows the error when the server refuses it", async () => {
    const { onCardUpdated } = setup({
      "PATCH /api/v1/cards/card-1": errorResponse(400, "VALIDATION_ERROR", "Bad due date"),
    });
    const input = await screen.findByLabelText("Due date");
    await userEvent.type(input, "2030-05-06T07:08");
    await userEvent.click(screen.getByRole("button", { name: "Save due date" }));
    expect(await screen.findByText("Bad due date")).toBeInTheDocument();
    expect(input).toHaveValue("2030-05-06T07:08");
    expect(onCardUpdated).not.toHaveBeenCalled();
  });

  // --- B3: priority select ---

  it("priority select shows the current priority of the card", async () => {
    const withPriority = { ...card, priority: "high" as const };
    setup({}, { card: withPriority });
    const select = await screen.findByLabelText("Priority");
    expect(select).toHaveValue("high");
  });

  it("priority select shows No priority when card has null priority", async () => {
    setup();
    const select = await screen.findByLabelText("Priority");
    expect(select).toHaveValue("");
  });

  it("changing priority calls PATCH with the correct priority payload", async () => {
    const updated = { ...card, priority: "medium" as const };
    const { calls, onCardUpdated } = setup({
      "PATCH /api/v1/cards/card-1": jsonResponse(200, { data: updated }),
    });
    const select = await screen.findByLabelText("Priority");
    await userEvent.selectOptions(select, "medium");
    await waitFor(() => expect(onCardUpdated).toHaveBeenCalledWith(updated));
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch?.body).toEqual({ priority: "medium" });
  });

  it("clearing priority (No priority) sends null in the PATCH body", async () => {
    const withPriority = { ...card, priority: "low" as const };
    const cleared = { ...card, priority: null };
    const { calls, onCardUpdated } = setup(
      { "PATCH /api/v1/cards/card-1": jsonResponse(200, { data: cleared }) },
      { card: withPriority },
    );
    const select = await screen.findByLabelText("Priority");
    await userEvent.selectOptions(select, "");
    await waitFor(() => expect(onCardUpdated).toHaveBeenCalledWith(cleared));
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch?.body).toEqual({ priority: null });
  });
});
