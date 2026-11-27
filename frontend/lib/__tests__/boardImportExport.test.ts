import { exportBoard, validateImport } from "@/lib/boardImportExport";
import type { BoardDetail, Card, ColumnWithCards, Label } from "@/lib/types/api";

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
  };
}

function makeColumn(
  id: string,
  name: string,
  position: number,
  cards: Card[],
  overrides: Partial<ColumnWithCards> = {},
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
    ...overrides,
  };
}

const labels: Label[] = [
  {
    id: "l-1",
    board_id: "b-1",
    name: "Bug",
    color: "red",
    created_at: stamp,
    updated_at: stamp,
  },
];

describe("exportBoard", () => {
  it("produces the correct shape with no ids, orders, or secrets", () => {
    const board: BoardDetail = {
      id: "b-1",
      name: "My Board",
      user_id: "u-1",
      is_favorite: false,
      created_at: stamp,
      updated_at: stamp,
      columns: [
        makeColumn("c-2", "Done", 2, [], { color: "green", is_done: true }),
        makeColumn("c-1", "To Do", 1, [
          makeCard({
            id: "card-1",
            column_id: "c-1",
            title: "Write spec",
            order: 1,
            description: "The spec",
            priority: "high",
            due_date: "2026-12-01T17:00:00Z",
            labels: [{ id: "l-1", name: "Bug", color: "red" }],
          }),
          makeCard({
            id: "card-2",
            column_id: "c-1",
            title: "Plain",
            order: 0,
          }),
        ]),
      ],
      labels,
    };

    const parsed = JSON.parse(exportBoard(board));

    // Columns sorted by position: To Do first, then Done
    expect(parsed.board.name).toBe("My Board");
    expect(parsed.board.columns).toHaveLength(2);
    expect(parsed.board.columns[0].name).toBe("To Do");
    expect(parsed.board.columns[0].color).toBeNull();
    expect(parsed.board.columns[0].is_done).toBe(false);
    expect(parsed.board.columns[1].name).toBe("Done");
    expect(parsed.board.columns[1].color).toBe("green");
    expect(parsed.board.columns[1].is_done).toBe(true);

    // Cards sorted by order within the column
    const todoCards = parsed.board.columns[0].cards;
    expect(todoCards).toHaveLength(2);
    expect(todoCards[0].title).toBe("Plain");
    expect(todoCards[1].title).toBe("Write spec");
    expect(todoCards[1].description).toBe("The spec");
    expect(todoCards[1].priority).toBe("high");
    expect(todoCards[1].due_date).toBe("2026-12-01T17:00:00Z");
    expect(todoCards[1].labels).toEqual([{ name: "Bug", color: "red" }]);

    // No ids, orders, owners, or timestamps anywhere in the payload
    const json = JSON.stringify(parsed);
    expect(json).not.toContain("b-1");
    expect(json).not.toContain("c-1");
    expect(json).not.toContain("card-1");
    expect(json).not.toContain("u-1");
    expect(json).not.toContain("\"order\"");
    expect(json).not.toContain("created_at");
    expect(json).not.toContain("owner_id");
  });

  it("exports an empty board with an empty columns array", () => {
    const board: BoardDetail = {
      id: "b-1",
      name: "Empty",
      user_id: "u-1",
      is_favorite: false,
      created_at: stamp,
      updated_at: stamp,
      columns: [],
      labels: [],
    };
    const parsed = JSON.parse(exportBoard(board));
    expect(parsed.board.columns).toEqual([]);
  });
});

describe("validateImport", () => {
  const validFile = () => ({
    board: {
      name: "Imported",
      columns: [
        {
          name: "To Do",
          color: null,
          is_done: false,
          cards: [
            {
              title: "Task A",
              description: "Desc",
              priority: "high",
              due_date: "2026-12-01T17:00:00Z",
              labels: [{ name: "Bug", color: "red" }],
            },
            { title: "Task B" },
          ],
        },
        { name: "Done", color: "green", is_done: true, cards: [] },
      ],
    },
  });

  it("accepts a valid file and returns normalised data", () => {
    const result = validateImport(validFile());
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.board.name).toBe("Imported");
      expect(result.data.board.columns).toHaveLength(2);
      expect(result.data.board.columns[0].cards[0].title).toBe("Task A");
      expect(result.data.board.columns[0].cards[0].labels).toEqual([
        { name: "Bug", color: "red" },
      ]);
    }
  });

  it("accepts an empty columns array", () => {
    const result = validateImport({ board: { name: "X", columns: [] } });
    expect(result.valid).toBe(true);
  });

  it("accepts a column without a cards key", () => {
    const result = validateImport({ board: { name: "X", columns: [{ name: "Solo" }] } });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.board.columns[0].cards).toEqual([]);
    }
  });

  it("allows extra unknown fields", () => {
    const file = validFile() as Record<string, unknown>;
    const board = (file.board as Record<string, unknown>);
    board.unknownTop = "whatever";
    const cols = board.columns as Record<string, unknown>[];
    cols[0].extra = { nested: true };
    (cols[0].cards as Record<string, unknown>[])[0].future = 42;
    const result = validateImport(file);
    expect(result.valid).toBe(true);
  });

  it("tolerates null values for optional fields", () => {
    const file = {
      board: {
        columns: [
          {
            name: "C",
            color: null,
            is_done: null,
            cards: [{ title: "T", description: null, priority: null, due_date: null, labels: null }],
          },
        ],
      },
    };
    const result = validateImport(file);
    expect(result.valid).toBe(true);
    if (result.valid) {
      const card = result.data.board.columns[0].cards[0];
      expect(card.description).toBeNull();
      expect(card.priority).toBeNull();
      expect(card.due_date).toBeNull();
      expect(card.labels).toEqual([]);
      expect(result.data.board.columns[0].is_done).toBe(false);
    }
  });

  it("rejects a missing board object", () => {
    expect(validateImport({}).valid).toBe(false);
    expect(validateImport(null).valid).toBe(false);
    expect(validateImport("string").valid).toBe(false);
    expect(validateImport([1, 2]).valid).toBe(false);
  });

  it("rejects a missing columns array", () => {
    const result = validateImport({ board: { name: "X" } });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain("columns");
  });

  it("rejects a non-array columns value", () => {
    const result = validateImport({ board: { columns: "nope" } });
    expect(result.valid).toBe(false);
  });

  it("rejects a column without a string name", () => {
    const result = validateImport({
      board: { columns: [{ cards: [] }] },
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain("name");
  });

  it("rejects a column whose name is not a string", () => {
    const result = validateImport({
      board: { columns: [{ name: 42 }] },
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a card without a string title", () => {
    const result = validateImport({
      board: { columns: [{ name: "C", cards: [{ description: "no title" }] }] },
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain("title");
  });

  it("rejects a card whose title is not a string", () => {
    const result = validateImport({
      board: { columns: [{ name: "C", cards: [{ title: 99 }] }] },
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a non-array cards value", () => {
    const result = validateImport({
      board: { columns: [{ name: "C", cards: "oops" }] },
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a non-object column entry", () => {
    const result = validateImport({
      board: { columns: ["just a string"] },
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a non-object card entry", () => {
    const result = validateImport({
      board: { columns: [{ name: "C", cards: [null] }] },
    });
    expect(result.valid).toBe(false);
  });
});
