import {
  countActiveFilters,
  EMPTY_FILTERS,
  filterColumns,
  matchesFilters,
  type CardFilters,
} from "@/lib/filterCards";
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

const filters = (overrides: Partial<CardFilters>): CardFilters => ({
  ...EMPTY_FILTERS,
  ...overrides,
});

describe("matchesFilters", () => {
  it("matches everything when no filter is active", () => {
    expect(matchesFilters(card(), EMPTY_FILTERS, NOW)).toBe(true);
  });

  describe("keyword", () => {
    it("matches the title case-insensitively and trims the keyword", () => {
      expect(matchesFilters(card(), filters({ keyword: "  WRITE " }), NOW)).toBe(true);
    });

    it("matches the description", () => {
      const c = card({ description: "Talk to the Team" });
      expect(matchesFilters(c, filters({ keyword: "team" }), NOW)).toBe(true);
    });

    it("handles a null description", () => {
      expect(matchesFilters(card({ description: null }), filters({ keyword: "zzz" }), NOW)).toBe(
        false,
      );
    });

    it("treats a blank keyword as no filter", () => {
      expect(matchesFilters(card(), filters({ keyword: "   " }), NOW)).toBe(true);
    });
  });

  describe("labels (ANY)", () => {
    const labelled = card({
      labels: [
        { id: "l-1", name: "Bug", color: "red" },
        { id: "l-2", name: "Docs", color: "blue" },
      ],
    });

    it("matches when the card has at least one selected label", () => {
      expect(matchesFilters(labelled, filters({ labelIds: ["l-2", "l-9"] }), NOW)).toBe(true);
    });

    it("does not match when the card has none of the selected labels", () => {
      expect(matchesFilters(labelled, filters({ labelIds: ["l-9"] }), NOW)).toBe(false);
      expect(matchesFilters(card(), filters({ labelIds: ["l-1"] }), NOW)).toBe(false);
    });
  });

  describe("due date", () => {
    const due = (ms: number) => card({ due_date: iso(ms) });
    const t = NOW.getTime();

    it("overdue is strictly before now", () => {
      const f = filters({ due: "overdue" });
      expect(matchesFilters(due(t - 1), f, NOW)).toBe(true);
      expect(matchesFilters(due(t), f, NOW)).toBe(false);
      expect(matchesFilters(due(t + HOUR), f, NOW)).toBe(false);
    });

    it("24h includes now and now + 24 hours but not a millisecond later", () => {
      const f = filters({ due: "24h" });
      expect(matchesFilters(due(t), f, NOW)).toBe(true);
      expect(matchesFilters(due(t + 24 * HOUR), f, NOW)).toBe(true);
      expect(matchesFilters(due(t + 24 * HOUR + 1), f, NOW)).toBe(false);
      expect(matchesFilters(due(t - 1), f, NOW)).toBe(false);
    });

    it("7d includes now + 7 days but not a millisecond later", () => {
      const f = filters({ due: "7d" });
      expect(matchesFilters(due(t + 7 * 24 * HOUR), f, NOW)).toBe(true);
      expect(matchesFilters(due(t + 7 * 24 * HOUR + 1), f, NOW)).toBe(false);
    });

    it("none matches only cards without a due date", () => {
      const f = filters({ due: "none" });
      expect(matchesFilters(card(), f, NOW)).toBe(true);
      expect(matchesFilters(due(t + HOUR), f, NOW)).toBe(false);
    });

    it("a card without a due date never matches overdue, 24h or 7d", () => {
      for (const value of ["overdue", "24h", "7d"] as const) {
        expect(matchesFilters(card(), filters({ due: value }), NOW)).toBe(false);
      }
    });

    it("an unparseable due date does not match a date filter", () => {
      expect(
        matchesFilters(card({ due_date: "garbage" }), filters({ due: "overdue" }), NOW),
      ).toBe(false);
    });
  });

  describe("due overdue excludes done column", () => {
    const t = NOW.getTime();
    const overdueCard = card({ due_date: iso(t - HOUR) });

    it("overdue card in a non-done column is included", () => {
      expect(matchesFilters(overdueCard, filters({ due: "overdue" }), NOW, false)).toBe(true);
    });

    it("overdue card in a done column is excluded", () => {
      expect(matchesFilters(overdueCard, filters({ due: "overdue" }), NOW, true)).toBe(false);
    });

    it("isDoneColumn=true does not affect other due filters", () => {
      const futureCard = card({ due_date: iso(t + HOUR) });
      expect(matchesFilters(futureCard, filters({ due: "24h" }), NOW, true)).toBe(true);
    });
  });

  describe("due today", () => {
    // Use local dates to construct cards at local midnight boundaries.
    const y = NOW.getFullYear();
    const m = NOW.getMonth();
    const d = NOW.getDate();
    // Local midnight of today:
    const todayMidnightLocal = new Date(y, m, d).getTime();
    // Local 23:59:59.999 of today:
    const todayEndLocal = new Date(y, m, d + 1).getTime() - 1;
    // Yesterday midnight:
    const yesterdayMidnightLocal = new Date(y, m, d - 1).getTime();

    const f = filters({ due: "today" });

    it("card due at start of today (local midnight) matches", () => {
      expect(matchesFilters(card({ due_date: iso(todayMidnightLocal) }), f, NOW)).toBe(true);
    });

    it("card due at end of today matches", () => {
      expect(matchesFilters(card({ due_date: iso(todayEndLocal) }), f, NOW)).toBe(true);
    });

    it("card due yesterday midnight does not match", () => {
      expect(matchesFilters(card({ due_date: iso(yesterdayMidnightLocal) }), f, NOW)).toBe(false);
    });

    it("card without a due date does not match", () => {
      expect(matchesFilters(card(), f, NOW)).toBe(false);
    });
  });

  describe("priority", () => {
    it("matches a card with the exact priority", () => {
      expect(matchesFilters(card({ priority: "low" }), filters({ priority: "low" }), NOW)).toBe(true);
    });

    it("does not match a card with a different priority", () => {
      expect(matchesFilters(card({ priority: "medium" }), filters({ priority: "low" }), NOW)).toBe(false);
    });

    it("does not match a null-priority card when a priority filter is set", () => {
      expect(matchesFilters(card({ priority: null }), filters({ priority: "low" }), NOW)).toBe(false);
    });

    it("any priority matches everything", () => {
      expect(matchesFilters(card({ priority: null }), filters({ priority: "any" }), NOW)).toBe(true);
      expect(matchesFilters(card({ priority: "high" }), filters({ priority: "any" }), NOW)).toBe(true);
    });
  });

  it("combines keyword, labels, due date, and priority with AND", () => {
    const c = card({
      title: "Write spec",
      labels: [{ id: "l-1", name: "Bug", color: "red" }],
      due_date: iso(NOW.getTime() + HOUR),
      priority: "high",
    });
    const all = filters({ keyword: "spec", labelIds: ["l-1"], due: "24h", priority: "high" });
    expect(matchesFilters(c, all, NOW)).toBe(true);
    expect(matchesFilters(c, { ...all, keyword: "other" }, NOW)).toBe(false);
    expect(matchesFilters(c, { ...all, labelIds: ["l-2"] }, NOW)).toBe(false);
    expect(matchesFilters(c, { ...all, due: "overdue" }, NOW)).toBe(false);
    expect(matchesFilters(c, { ...all, priority: "low" }, NOW)).toBe(false);
  });
});

describe("countActiveFilters", () => {
  it("counts keyword, labels, due date, and priority separately", () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(countActiveFilters(filters({ keyword: "  " }))).toBe(0);
    expect(countActiveFilters({ keyword: "a", labelIds: ["l-1", "l-2"], due: "7d", priority: "any" })).toBe(3);
    expect(countActiveFilters({ keyword: "a", labelIds: ["l-1"], due: "7d", priority: "high" })).toBe(4);
    expect(countActiveFilters(filters({ priority: "medium" }))).toBe(1);
  });
});

describe("filterColumns", () => {
  const columns: ColumnWithCards[] = [
    {
      id: "c-1",
      board_id: "b-1",
      name: "To Do",
      position: 1,
      color: null,
      is_done: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      cards: [card({ id: "a", title: "Alpha" }), card({ id: "b", title: "Beta" })],
    } as ColumnWithCards,
  ];

  const doneColumns: ColumnWithCards[] = [
    {
      id: "c-done",
      board_id: "b-1",
      name: "Done",
      position: 2,
      color: null,
      is_done: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      cards: [
        card({ id: "d1", title: "Finished", due_date: iso(NOW.getTime() - HOUR) }),
      ],
    } as ColumnWithCards,
  ];

  it("returns new columns with only matching cards and the unfiltered total", () => {
    const result = filterColumns(columns, filters({ keyword: "alp" }), NOW);
    expect(result).toHaveLength(1);
    expect(result[0].cards.map((c) => c.id)).toEqual(["a"]);
    expect(result[0].total).toBe(2);
  });

  it("returns an empty cards list when nothing matches", () => {
    const result = filterColumns(columns, filters({ keyword: "zzz" }), NOW);
    expect(result[0].cards).toEqual([]);
    expect(result[0].total).toBe(2);
  });

  it("does not mutate its inputs", () => {
    const snapshot = JSON.parse(JSON.stringify(columns));
    const f = filters({ keyword: "alp", labelIds: ["l-1"] });
    const fSnapshot = JSON.parse(JSON.stringify(f));
    const result = filterColumns(columns, f, NOW);
    expect(columns).toEqual(snapshot);
    expect(f).toEqual(fSnapshot);
    expect(result[0]).not.toBe(columns[0]);
    expect(columns[0].cards).toHaveLength(2);
  });

  it("excludes overdue cards from done columns when overdue filter is active", () => {
    const result = filterColumns(doneColumns, filters({ due: "overdue" }), NOW);
    expect(result[0].cards).toHaveLength(0);
    expect(result[0].total).toBe(1);
  });
});
