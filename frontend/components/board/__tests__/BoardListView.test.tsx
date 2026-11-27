import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardListView } from "@/components/board/BoardListView";
import type { Card, ColumnWithCards } from "@/lib/types/api";

const stamp = "2026-01-01T00:00:00Z";

function makeCard(overrides: Partial<Card> & { id: string; column_id: string; title: string }): Card {
  return {
    owner_id: "u-1",
    description: null,
    order: 0,
    due_date: null,
    priority: null,
    labels: [],
    deleted_at: null,
    created_at: stamp,
    updated_at: stamp,
    ...overrides,
  } as Card;
}

function makeColumn(
  id: string,
  name: string,
  position: number,
  cards: Card[],
): ColumnWithCards {
  return {
    id,
    board_id: "b-1",
    name,
    position,
    color: null,
    is_done: false,
    created_at: stamp,
    updated_at: stamp,
    cards,
  };
}

const cardA = makeCard({ id: "c-1", column_id: "col-1", title: "Alpha task", order: 1 });
const cardB = makeCard({
  id: "c-2",
  column_id: "col-2",
  title: "Beta task",
  order: 2,
  priority: "high",
  due_date: "2026-11-05T00:00:00Z",
  labels: [{ id: "l-1", name: "Bug", color: "red" }],
});
const cardC = makeCard({ id: "c-3", column_id: "col-1", title: "Gamma task", order: 3 });

const columns: ColumnWithCards[] = [
  makeColumn("col-1", "To Do", 0, [cardA, cardC]),
  makeColumn("col-2", "In Progress", 1, [cardB]),
];

describe("BoardListView", () => {
  it("renders a row for every card with title and column name", () => {
    render(<BoardListView columns={columns} sortBy="manual" groupBy="none" onOpenCard={jest.fn()} />);

    expect(screen.getByRole("cell", { name: "Alpha task" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Beta task" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Gamma task" })).toBeInTheDocument();

    // Column names appear in data-column-name cells
    const colCells = screen.getAllByRole("cell").filter(
      (el) => el.getAttribute("data-column-name") !== null,
    );
    const names = colCells.map((el) => el.getAttribute("data-column-name"));
    expect(names).toContain("To Do");
    expect(names).toContain("In Progress");
  });

  it("renders priority when set, nothing when null", () => {
    render(<BoardListView columns={columns} sortBy="manual" groupBy="none" onOpenCard={jest.fn()} />);

    // cardB has priority "high"; cardA and cardC have null priority (no priority indicator)
    // The table renders a data-priority span only when priority is set
    const prioritySpans = screen.getAllByRole("cell").flatMap((cell) =>
      Array.from(cell.querySelectorAll("[data-priority]")),
    );
    // Only one card (cardB) has a priority set
    expect(prioritySpans).toHaveLength(1);
    expect(prioritySpans[0]).toHaveAttribute("data-priority", "high");
    expect(prioritySpans[0]).toHaveTextContent("High");
  });

  it("renders formatted due date in the correct cell", () => {
    render(<BoardListView columns={columns} sortBy="manual" groupBy="none" onOpenCard={jest.fn()} />);
    // 2026-11-05 → "Nov 5, 2026"
    expect(screen.getByText("Nov 5, 2026")).toBeInTheDocument();
  });

  it("renders label names for cards with labels", () => {
    render(<BoardListView columns={columns} sortBy="manual" groupBy="none" onOpenCard={jest.fn()} />);
    expect(screen.getByText("Bug")).toBeInTheDocument();
  });

  it("calls onOpenCard with the clicked card", async () => {
    const onOpen = jest.fn();
    render(<BoardListView columns={columns} sortBy="manual" groupBy="none" onOpenCard={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: "Open card: Alpha task" }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "c-1", title: "Alpha task" }));
  });

  it("shows 'No tasks' when columns are empty", () => {
    const emptyCols = [makeColumn("col-1", "To Do", 0, [])];
    render(<BoardListView columns={emptyCols} sortBy="manual" groupBy="none" onOpenCard={jest.fn()} />);
    expect(screen.getByText("No tasks")).toBeInTheDocument();
  });

  it("filters apply — only cards in filtered columns appear", () => {
    // Simulate filtered state: only col-2 has cards
    const filteredColumns: ColumnWithCards[] = [
      makeColumn("col-1", "To Do", 0, []),
      makeColumn("col-2", "In Progress", 1, [cardB]),
    ];
    render(<BoardListView columns={filteredColumns} sortBy="manual" groupBy="none" onOpenCard={jest.fn()} />);
    expect(screen.queryByText("Alpha task")).not.toBeInTheDocument();
    expect(screen.getByText("Beta task")).toBeInTheDocument();
  });

  it("renders table with aria-label 'Task list'", () => {
    render(<BoardListView columns={columns} sortBy="manual" groupBy="none" onOpenCard={jest.fn()} />);
    expect(screen.getByRole("table", { name: "Task list" })).toBeInTheDocument();
  });

  describe("groupBy='priority'", () => {
    const colsWithPriority: ColumnWithCards[] = [
      makeColumn("col-1", "To Do", 0, [
        makeCard({ id: "h-1", column_id: "col-1", title: "High task", order: 0, priority: "high" }),
        makeCard({ id: "l-1", column_id: "col-1", title: "Low task", order: 1, priority: "low" }),
        makeCard({ id: "n-1", column_id: "col-1", title: "No priority task", order: 2, priority: null }),
      ]),
    ];

    it("renders a header row for each priority group including empty ones", () => {
      render(<BoardListView columns={colsWithPriority} sortBy="manual" groupBy="priority" onOpenCard={jest.fn()} />);
      expect(screen.getByRole("columnheader", { name: /High \(1\)/ })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: /Medium \(0\)/ })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: /Low \(1\)/ })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: /No priority \(1\)/ })).toBeInTheDocument();
    });

    it("cards appear under their correct priority group header", () => {
      render(<BoardListView columns={colsWithPriority} sortBy="manual" groupBy="priority" onOpenCard={jest.fn()} />);
      expect(screen.getByRole("button", { name: "Open card: High task" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Open card: Low task" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Open card: No priority task" })).toBeInTheDocument();
    });
  });
});
