import { groupByPriority, groupCardsByPriority } from "@/lib/groupCards";
import type { Card, ColumnWithCards } from "@/lib/types/api";
import type { FilteredColumn } from "@/lib/filterCards";

const stamp = "2026-01-01T00:00:00Z";

function makeCard(id: string, priority: "high" | "medium" | "low" | null, columnId = "c-1"): Card {
  return {
    id,
    column_id: columnId,
    owner_id: "u-1",
    title: `Card ${id}`,
    description: null,
    order: 0,
    due_date: null,
    priority,
    labels: [],
    deleted_at: null,
    created_at: stamp,
    updated_at: stamp,
  };
}

function makeFilteredColumn(
  id: string,
  cards: Card[],
  overrides: Partial<ColumnWithCards> = {},
): FilteredColumn {
  return {
    id,
    board_id: "b-1",
    name: `Col ${id}`,
    position: 0,
    color: null,
    is_done: false,
    created_at: stamp,
    updated_at: stamp,
    cards,
    total: cards.length,
    ...overrides,
  };
}

describe("groupByPriority (kanban)", () => {
  it("returns groups in the correct order: high → medium → low → no priority", () => {
    const col = makeFilteredColumn("c-1", [
      makeCard("a", "low"),
      makeCard("b", null),
      makeCard("c", "high"),
      makeCard("d", "medium"),
    ]);
    const groups = groupByPriority([col]);
    expect(groups.map((g) => g.key)).toEqual(["high", "medium", "low", null]);
  });

  it("omits groups that have no cards across all columns (kanban behavior)", () => {
    // Only high and null cards; medium and low should not appear
    const col = makeFilteredColumn("c-1", [
      makeCard("a", "high"),
      makeCard("b", null),
    ]);
    const groups = groupByPriority([col]);
    expect(groups.map((g) => g.key)).toEqual(["high", null]);
  });

  it("each group's column contains only its own priority cards", () => {
    const col = makeFilteredColumn("c-1", [
      makeCard("h1", "high"),
      makeCard("m1", "medium"),
      makeCard("l1", "low"),
      makeCard("n1", null),
    ]);
    const groups = groupByPriority([col]);

    const highGroup = groups.find((g) => g.key === "high")!;
    expect(highGroup.columns[0].cards.map((c) => c.id)).toEqual(["h1"]);

    const noneGroup = groups.find((g) => g.key === null)!;
    expect(noneGroup.columns[0].cards.map((c) => c.id)).toEqual(["n1"]);
  });

  it("includes all columns in every group, even those with no cards for that priority", () => {
    const colA = makeFilteredColumn("c-1", [makeCard("h1", "high")]);
    const colB = makeFilteredColumn("c-2", [makeCard("m1", "medium")]);
    const groups = groupByPriority([colA, colB]);

    const highGroup = groups.find((g) => g.key === "high")!;
    expect(highGroup.columns).toHaveLength(2);
    // c-2 has no high cards
    expect(highGroup.columns.find((c) => c.id === "c-2")!.cards).toHaveLength(0);
  });

  it("returns empty array when all columns are empty", () => {
    const col = makeFilteredColumn("c-1", []);
    expect(groupByPriority([col])).toEqual([]);
  });

  it("returns empty array when called with no columns", () => {
    expect(groupByPriority([])).toEqual([]);
  });

  it("does not mutate the input columns", () => {
    const col = makeFilteredColumn("c-1", [makeCard("h1", "high"), makeCard("l1", "low")]);
    const snapshot = JSON.stringify(col);
    groupByPriority([col]);
    expect(JSON.stringify(col)).toBe(snapshot);
  });

  it("includes a 'No priority' group when there are null-priority cards", () => {
    const col = makeFilteredColumn("c-1", [makeCard("n1", null)]);
    const groups = groupByPriority([col]);
    const noneGroup = groups.find((g) => g.key === null);
    expect(noneGroup).toBeDefined();
    expect(noneGroup!.label).toBe("No priority");
  });
});

describe("groupCardsByPriority (list view)", () => {
  type RowCard = Card & { columnName: string };

  function row(id: string, priority: "high" | "medium" | "low" | null): RowCard {
    return { ...makeCard(id, priority), columnName: "To Do" };
  }

  it("returns four groups in the correct order regardless of card distribution", () => {
    const cards: RowCard[] = [row("a", "low"), row("b", "high"), row("c", null)];
    const groups = groupCardsByPriority(cards);
    expect(groups.map((g) => g.key)).toEqual(["high", "medium", "low", null]);
  });

  it("includes all four groups even when some are empty (list behavior)", () => {
    const cards: RowCard[] = [row("a", "high")];
    const groups = groupCardsByPriority(cards);
    expect(groups).toHaveLength(4);
    expect(groups.find((g) => g.key === "medium")!.cards).toHaveLength(0);
    expect(groups.find((g) => g.key === "low")!.cards).toHaveLength(0);
    expect(groups.find((g) => g.key === null)!.cards).toHaveLength(0);
  });

  it("includes empty groups even when all cards are empty", () => {
    const groups = groupCardsByPriority([]);
    expect(groups).toHaveLength(4);
    for (const g of groups) expect(g.cards).toHaveLength(0);
  });

  it("places each card in the right group", () => {
    const cards: RowCard[] = [
      row("h1", "high"),
      row("h2", "high"),
      row("m1", "medium"),
      row("n1", null),
    ];
    const groups = groupCardsByPriority(cards);
    expect(groups.find((g) => g.key === "high")!.cards.map((c) => c.id)).toEqual(["h1", "h2"]);
    expect(groups.find((g) => g.key === "medium")!.cards.map((c) => c.id)).toEqual(["m1"]);
    expect(groups.find((g) => g.key === null)!.cards.map((c) => c.id)).toEqual(["n1"]);
  });
});
