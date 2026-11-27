import { sortCards, sortColumns, type SortBy } from "@/lib/sortCards";
import type { FilteredColumn } from "@/lib/filterCards";
import type { Card, ColumnWithCards } from "@/lib/types/api";

const NOW = new Date("2026-03-10T12:00:00Z");
const HOUR = 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

function card(overrides: Partial<Card> = {}): Card {
  return {
    id: "card-1",
    column_id: "c-1",
    owner_id: "u-1",
    title: "Write spec",
    description: null,
    order: 0,
    due_date: null,
    priority: null,
    labels: [],
    deleted_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as Card;
}

function column(cards: Card[], overrides: Partial<ColumnWithCards> = {}): FilteredColumn {
  return {
    id: "c-1",
    board_id: "b-1",
    name: "To Do",
    position: 1,
    color: null,
    is_done: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    cards,
    total: cards.length,
    ...overrides,
  } as FilteredColumn;
}

describe("sortCards", () => {
  describe("manual", () => {
    it("sorts by order ascending", () => {
      const cards = [card({ id: "a", order: 3 }), card({ id: "b", order: 1 }), card({ id: "c", order: 2 })];
      expect(sortCards(cards, "manual").map((c) => c.id)).toEqual(["b", "c", "a"]);
    });

    it("never mutates the input array", () => {
      const cards = [card({ id: "a", order: 3 }), card({ id: "b", order: 1 })];
      const input = [...cards];
      const result = sortCards(cards, "manual");
      expect(cards).toEqual(input);
      expect(result).not.toBe(cards);
    });
  });

  describe("due", () => {
    it("sorts by due_date ascending (Date.parse)", () => {
      const t = NOW.getTime();
      const cards = [
        card({ id: "a", order: 0, due_date: iso(t + 2 * HOUR) }),
        card({ id: "b", order: 1, due_date: iso(t + HOUR) }),
        card({ id: "c", order: 2, due_date: iso(t + 3 * HOUR) }),
      ];
      expect(sortCards(cards, "due").map((c) => c.id)).toEqual(["b", "a", "c"]);
    });

    it("places cards without a due date last, preserving their relative order", () => {
      const t = NOW.getTime();
      const cards = [
        card({ id: "no-1", order: 0, due_date: null }),
        card({ id: "due-1", order: 1, due_date: iso(t + HOUR) }),
        card({ id: "no-2", order: 2, due_date: null }),
      ];
      expect(sortCards(cards, "due").map((c) => c.id)).toEqual(["due-1", "no-1", "no-2"]);
    });

    it("tie-breaks equal due dates by order ascending", () => {
      const t = NOW.getTime();
      const cards = [
        card({ id: "a", order: 2, due_date: iso(t) }),
        card({ id: "b", order: 1, due_date: iso(t) }),
      ];
      expect(sortCards(cards, "due").map((c) => c.id)).toEqual(["b", "a"]);
    });
  });

  describe("priority", () => {
    it("sorts high, medium, low, null", () => {
      const cards = [
        card({ id: "low", order: 0, priority: "low" }),
        card({ id: "none", order: 1, priority: null }),
        card({ id: "high", order: 2, priority: "high" }),
        card({ id: "medium", order: 3, priority: "medium" }),
      ];
      expect(sortCards(cards, "priority").map((c) => c.id)).toEqual([
        "high",
        "medium",
        "low",
        "none",
      ]);
    });

    it("tie-breaks equal priorities by order ascending", () => {
      const cards = [
        card({ id: "a", order: 1, priority: "medium" }),
        card({ id: "b", order: 0, priority: "medium" }),
      ];
      expect(sortCards(cards, "priority").map((c) => c.id)).toEqual(["b", "a"]);
    });

    it("keeps null-priority cards after low", () => {
      const cards = [
        card({ id: "none", order: 0, priority: null }),
        card({ id: "low", order: 1, priority: "low" }),
      ];
      expect(sortCards(cards, "priority").map((c) => c.id)).toEqual(["low", "none"]);
    });
  });

  describe("created", () => {
    it("sorts newest first", () => {
      const cards = [
        card({ id: "old", order: 0, created_at: iso(NOW.getTime() - 10 * HOUR) }),
        card({ id: "new", order: 1, created_at: iso(NOW.getTime()) }),
        card({ id: "mid", order: 2, created_at: iso(NOW.getTime() - 5 * HOUR) }),
      ];
      expect(sortCards(cards, "created").map((c) => c.id)).toEqual(["new", "mid", "old"]);
    });

    it("tie-breaks equal created_at by order ascending", () => {
      const t = NOW.getTime();
      const cards = [
        card({ id: "a", order: 2, created_at: iso(t) }),
        card({ id: "b", order: 1, created_at: iso(t) }),
      ];
      expect(sortCards(cards, "created").map((c) => c.id)).toEqual(["b", "a"]);
    });
  });

  describe("title", () => {
    it("sorts case-insensitively ascending (A-Z)", () => {
      const cards = [
        card({ id: "a", order: 0, title: "banana" }),
        card({ id: "b", order: 1, title: "Apple" }),
        card({ id: "c", order: 2, title: "cherry" }),
      ];
      expect(sortCards(cards, "title").map((c) => c.id)).toEqual(["b", "a", "c"]);
    });

    it("tie-breaks equal titles by order ascending", () => {
      const cards = [
        card({ id: "a", order: 1, title: "Same" }),
        card({ id: "b", order: 0, title: "same" }),
      ];
      expect(sortCards(cards, "title").map((c) => c.id)).toEqual(["b", "a"]);
    });
  });

  it("stability: equal keys preserve input order (Array.prototype.sort is stable)", () => {
    // All keys equal → input order (which is the sort input order) is preserved.
    const cards = [
      card({ id: "a", order: 0, priority: "high", due_date: iso(NOW.getTime()) }),
      card({ id: "b", order: 1, priority: "high", due_date: iso(NOW.getTime()) }),
      card({ id: "c", order: 2, priority: "high", due_date: iso(NOW.getTime()) }),
    ];
    for (const sortBy of ["due", "priority", "created", "title"] as SortBy[]) {
      expect(sortCards(cards, sortBy).map((c) => c.id)).toEqual(["a", "b", "c"]);
    }
  });
});

describe("sortColumns", () => {
  const t = NOW.getTime();
  const cards = [
    card({ id: "low", order: 0, priority: "low", due_date: iso(t + HOUR) }),
    card({ id: "high", order: 1, priority: "high", due_date: iso(t - HOUR) }),
  ];

  it("manual returns the same column references (no-op)", () => {
    const cols = [column(cards)];
    const result = sortColumns(cols, "manual");
    expect(result).toBe(cols);
    expect(result[0]).toBe(cols[0]);
  });

  it("'due' sorts each column's cards by due date", () => {
    const cols = [column(cards)];
    const result = sortColumns(cols, "due");
    expect(result).not.toBe(cols);
    expect(result[0].cards.map((c) => c.id)).toEqual(["high", "low"]);
  });

  it("'priority' sorts each column's cards by priority", () => {
    const cols = [column(cards)];
    expect(sortColumns(cols, "priority")[0].cards.map((c) => c.id)).toEqual(["high", "low"]);
  });

  it("does not mutate the input columns", () => {
    const cols = [column(cards)];
    const snapshot = JSON.parse(JSON.stringify(cols));
    sortColumns(cols, "due");
    expect(cols).toEqual(snapshot);
  });
});
