import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardColumn } from "@/components/board/BoardColumn";
import { showError, showSuccess } from "@/lib/toast";
import type { DragHandlers } from "@/hooks/useDragAndDrop";
import type { Card, ColumnColor, ColumnWithCards } from "@/lib/types/api";

jest.mock("@/lib/toast", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
}));

const stamp = "2026-01-01T00:00:00Z";

function card(id: string, title: string, order: number): Card {
  return {
    id,
    column_id: "c-1",
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
  } as Card;
}

function makeColumn(cards: Card[]): ColumnWithCards {
  return {
    id: "c-1",
    board_id: "b-1",
    name: "To Do",
    position: 1,
    color: null,
    is_done: false,
    created_at: stamp,
    updated_at: stamp,
    cards,
  } as ColumnWithCards;
}

const handlers: DragHandlers = {
  onDragStart: jest.fn(),
  onDragEnd: jest.fn(),
  onDragOver: jest.fn(),
  onDrop: jest.fn(),
};

function renderColumn(props: {
  cards: Card[];
  boardName?: string;
  totalCount?: number;
  dragEnabled?: boolean;
  index?: number;
  color?: ColumnColor | null;
}) {
  return render(
    <BoardColumn
      column={{ ...makeColumn(props.cards), color: props.color ?? null }}
      index={props.index}
      boardName={props.boardName}
      onRename={jest.fn()}
      onDelete={jest.fn()}
      onAddCard={jest.fn()}
      onOpenCard={jest.fn()}
      dragHandlers={handlers}
      draggingCardId={null}
      now={new Date("2026-03-10T12:00:00Z")}
      totalCount={props.totalCount}
      dragEnabled={props.dragEnabled}
    />,
  );
}

describe("BoardColumn filtering and dragging", () => {
  beforeEach(() => jest.clearAllMocks());

  it("keeps cards draggable and the column a drop target by default", () => {
    renderColumn({ cards: [card("a", "Alpha", 0)] });
    const item = screen
      .getByRole("button", { name: "Open card: Alpha" })
      .closest("li");
    expect(item).toHaveAttribute("draggable", "true");
    expect(screen.getByLabelText("1 card")).toBeInTheDocument();
  });

  it("cycles the status color by column index when none is stored", () => {
    renderColumn({ cards: [], index: 6 });
    expect(screen.getByRole("banner")).toHaveAttribute("data-status", "blue");
  });

  it("uses the stored color over the cycled one", () => {
    renderColumn({ cards: [], index: 0, color: "green" });
    expect(screen.getByRole("banner")).toHaveAttribute("data-status", "green");
  });

  it("renders cards without draggable and without drop handlers when drag is disabled", () => {
    const { container } = renderColumn({
      cards: [card("a", "Alpha", 0)],
      totalCount: 3,
      dragEnabled: false,
    });
    const item = screen
      .getByRole("button", { name: "Open card: Alpha" })
      .closest("li");
    expect(item).not.toHaveAttribute("draggable");

    fireEvent.dragStart(item as HTMLElement);
    fireEvent.dragOver(item as HTMLElement);
    fireEvent.drop(item as HTMLElement);
    fireEvent.dragOver(container.querySelector("section") as HTMLElement);
    fireEvent.drop(container.querySelector("section") as HTMLElement);
    expect(handlers.onDragStart).not.toHaveBeenCalled();
    expect(handlers.onDragOver).not.toHaveBeenCalled();
    expect(handlers.onDrop).not.toHaveBeenCalled();
  });

  it("shows x of y in the header when a total is given", () => {
    renderColumn({ cards: [card("a", "Alpha", 0)], totalCount: 3 });
    expect(screen.getByLabelText("1 of 3 cards shown")).toBeInTheDocument();
  });

  it("does not say the column is empty when cards are only hidden", () => {
    renderColumn({ cards: [], totalCount: 2 });
    expect(screen.queryByText("No tasks")).not.toBeInTheDocument();
    expect(screen.getByLabelText("0 of 2 cards shown")).toBeInTheDocument();
  });

  it("says the column is empty when it has no cards at all", () => {
    renderColumn({ cards: [] });
    expect(screen.getByText("No tasks")).toBeInTheDocument();
  });

  it("passes boardName down so each card shows it", () => {
    renderColumn({ cards: [card("a", "Alpha", 0)], boardName: "My Board" });
    expect(screen.getByLabelText("Board: My Board")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// B2: Card kebab menu integration
// ---------------------------------------------------------------------------
describe("BoardColumn — B2 card kebab menu", () => {
  beforeEach(() => jest.clearAllMocks());

  function renderWithKebab(props: {
    cards?: Card[];
    onDeleteCard?: jest.Mock;
    onDuplicateCard?: jest.Mock;
  }) {
    const cards = props.cards ?? [card("c1", "My Task", 0)];
    return render(
      <BoardColumn
        column={makeColumn(cards)}
        onRename={jest.fn()}
        onDelete={jest.fn()}
        onAddCard={jest.fn()}
        onOpenCard={jest.fn()}
        dragHandlers={handlers}
        draggingCardId={null}
        now={new Date("2026-03-10T12:00:00Z")}
        onDeleteCard={props.onDeleteCard}
        onDuplicateCard={props.onDuplicateCard}
      />,
    );
  }

  // --- Card-delete confirmation modal ---

  it("opens a confirmation modal that shows the card title when Delete is selected", async () => {
    const user = userEvent.setup();
    renderWithKebab({ onDeleteCard: jest.fn().mockResolvedValue(undefined) });

    await user.click(
      screen.getByRole("button", { name: "Card actions for My Task" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("My Task");
  });

  it("calls onDeleteCard with the card and closes the modal on success", async () => {
    const user = userEvent.setup();
    const onDeleteCard = jest.fn().mockResolvedValue(undefined);
    renderWithKebab({ onDeleteCard });

    await user.click(
      screen.getByRole("button", { name: "Card actions for My Task" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(onDeleteCard).toHaveBeenCalledTimes(1));
    expect(onDeleteCard).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c1" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("shows an error toast and keeps the modal open when onDeleteCard rejects", async () => {
    const user = userEvent.setup();
    const onDeleteCard = jest
      .fn()
      .mockRejectedValue(new Error("Server refused"));
    renderWithKebab({ onDeleteCard });

    await user.click(
      screen.getByRole("button", { name: "Card actions for My Task" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() =>
      expect(showError).toHaveBeenCalledWith("Server refused"),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the modal without calling onDeleteCard when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onDeleteCard = jest.fn();
    renderWithKebab({ onDeleteCard });

    await user.click(
      screen.getByRole("button", { name: "Card actions for My Task" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onDeleteCard).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // --- Duplicate in-flight disabled state ---

  it("disables the Duplicate menu item while onDuplicateCard is in-flight", async () => {
    const user = userEvent.setup();
    // onDuplicateCard never resolves during this test so the card stays in-flight
    const onDuplicateCard = jest.fn(() => new Promise<void>(() => {}));
    renderWithKebab({ onDuplicateCard });

    // Trigger duplicate (without awaiting — it stays pending)
    await user.click(
      screen.getByRole("button", { name: "Card actions for My Task" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));

    // Open the menu again to check the disabled state
    await user.click(
      screen.getByRole("button", { name: "Card actions for My Task" }),
    );
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeDisabled();
  });

  // --- Duplicate: label-failure path ---

  it("re-enables the menu after onDuplicateCard rejects and does not call showSuccess", async () => {
    const user = userEvent.setup();
    // Simulates the label-failure path: the parent's onDuplicateCard rejects after the
    // card is created but label assignment fails. BoardColumn must clear isDuplicating.
    const onDuplicateCard = jest
      .fn()
      .mockRejectedValue(new Error("label failure"));
    renderWithKebab({ onDuplicateCard });

    await user.click(
      screen.getByRole("button", { name: "Card actions for My Task" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));

    // After rejection the in-flight flag must be cleared; re-opening the menu
    // must show Duplicate as enabled again.
    await user.click(
      screen.getByRole("button", { name: "Card actions for My Task" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("menuitem", { name: "Duplicate" }),
      ).not.toBeDisabled(),
    );
    expect(showSuccess).not.toHaveBeenCalled();
  });

  // --- Card-delete modal: combined title + Confirm callback ---

  it("shows the card title in the confirmation dialog and calls onDeleteCard when Confirm is clicked", async () => {
    const user = userEvent.setup();
    const onDeleteCard = jest.fn().mockResolvedValue(undefined);
    renderWithKebab({
      onDeleteCard,
      cards: [card("c1", "Important Task", 0)],
    });

    await user.click(
      screen.getByRole("button", { name: "Card actions for Important Task" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Important Task");

    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(onDeleteCard).toHaveBeenCalledTimes(1));
    expect(onDeleteCard).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c1", title: "Important Task" }),
    );
  });
});

// ---------------------------------------------------------------------------
// B5: DnD placeholder in original position while dragging
// ---------------------------------------------------------------------------
describe("BoardColumn — B5 drag placeholder", () => {
  beforeEach(() => jest.clearAllMocks());

  function renderWithDragging(draggingCardId: string | null, cards: Card[]) {
    return render(
      <BoardColumn
        column={makeColumn(cards)}
        onRename={jest.fn()}
        onDelete={jest.fn()}
        onAddCard={jest.fn()}
        onOpenCard={jest.fn()}
        dragHandlers={handlers}
        draggingCardId={draggingCardId}
        now={new Date("2026-03-10T12:00:00Z")}
      />,
    );
  }

  it("renders a placeholder li for the dragged card and normal content for others", () => {
    const cards = [card("x1", "Alpha", 0), card("x2", "Beta", 1)];
    renderWithDragging("x1", cards);

    // The dragged card slot is a placeholder
    const placeholder = document.querySelector('[data-placeholder="true"]');
    expect(placeholder).not.toBeNull();
    expect(placeholder!.tagName).toBe("LI");
    // The placeholder must not contain card content
    expect(placeholder!.textContent).toBe("");

    // The other card renders normally
    expect(screen.getByText("Beta")).toBeInTheDocument();
    // Alpha card body is replaced by placeholder
    expect(screen.queryByRole("button", { name: "Open card: Alpha" })).toBeNull();
  });

  it("renders all cards normally when draggingCardId is null", () => {
    const cards = [card("x1", "Alpha", 0), card("x2", "Beta", 1)];
    renderWithDragging(null, cards);

    expect(document.querySelector('[data-placeholder="true"]')).toBeNull();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("placeholder has aria-hidden=true", () => {
    const cards = [card("x1", "Only", 0)];
    renderWithDragging("x1", cards);
    const placeholder = document.querySelector('[data-placeholder="true"]');
    expect(placeholder).toHaveAttribute("aria-hidden", "true");
  });
});

// ---------------------------------------------------------------------------
// B6: isDoneColumn propagation from column.is_done to BoardCard
// ---------------------------------------------------------------------------
describe("BoardColumn — B6 isDoneColumn propagation", () => {
  beforeEach(() => jest.clearAllMocks());

  function renderColumnWithDone(is_done: boolean, cards: Card[]) {
    return render(
      <BoardColumn
        column={{ ...makeColumn(cards), is_done }}
        onRename={jest.fn()}
        onDelete={jest.fn()}
        onAddCard={jest.fn()}
        onOpenCard={jest.fn()}
        dragHandlers={handlers}
        draggingCardId={null}
        now={new Date("2026-03-10T12:00:00Z")}
      />,
    );
  }

  it('adds data-done="true" to card title elements when column.is_done is true', () => {
    renderColumnWithDone(true, [card("d1", "Done task", 0)]);
    const titleEl = screen.getByText("Done task");
    expect(titleEl).toHaveAttribute("data-done", "true");
  });

  it("does not add data-done to card title elements when column.is_done is false", () => {
    renderColumnWithDone(false, [card("d1", "Active task", 0)]);
    const titleEl = screen.getByText("Active task");
    expect(titleEl).not.toHaveAttribute("data-done");
  });

  it("propagates correctly with multiple cards", () => {
    renderColumnWithDone(true, [
      card("d1", "Task A", 0),
      card("d2", "Task B", 1),
    ]);
    expect(screen.getByText("Task A")).toHaveAttribute("data-done", "true");
    expect(screen.getByText("Task B")).toHaveAttribute("data-done", "true");
  });
});
