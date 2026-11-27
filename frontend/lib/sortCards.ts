import type { Card } from "@/lib/types/api";
import type { FilteredColumn } from "@/lib/filterCards";

export type SortBy = "manual" | "due" | "priority" | "created" | "title";

const PRIORITY_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Returns a sorted copy of `cards` without mutating the input.
 *
 * - manual:   order asc (server order)
 * - due:      due_date asc (Date.parse), nulls last; tie-break order asc
 * - priority: high→medium→low→null; tie-break order asc
 * - created:  created_at desc (newest first); tie-break order asc
 * - title:    title.toLowerCase() localeCompare asc; tie-break order asc
 */
export function sortCards(cards: Card[], sortBy: SortBy): Card[] {
  if (sortBy === "manual") {
    return [...cards].sort((a, b) => a.order - b.order);
  }

  if (sortBy === "due") {
    return [...cards].sort((a, b) => {
      const aMs = a.due_date !== null ? Date.parse(a.due_date) : null;
      const bMs = b.due_date !== null ? Date.parse(b.due_date) : null;
      if (aMs === null && bMs === null) return a.order - b.order;
      if (aMs === null) return 1;
      if (bMs === null) return -1;
      const diff = aMs - bMs;
      return diff !== 0 ? diff : a.order - b.order;
    });
  }

  if (sortBy === "priority") {
    return [...cards].sort((a, b) => {
      const aRank = a.priority !== null ? (PRIORITY_RANK[a.priority] ?? 3) : 3;
      const bRank = b.priority !== null ? (PRIORITY_RANK[b.priority] ?? 3) : 3;
      const diff = aRank - bRank;
      return diff !== 0 ? diff : a.order - b.order;
    });
  }

  if (sortBy === "created") {
    return [...cards].sort((a, b) => {
      const aMs = Date.parse(a.created_at);
      const bMs = Date.parse(b.created_at);
      const diff = bMs - aMs; // desc: newer first
      return diff !== 0 ? diff : a.order - b.order;
    });
  }

  // title
  return [...cards].sort((a, b) => {
    const cmp = a.title.toLowerCase().localeCompare(b.title.toLowerCase());
    return cmp !== 0 ? cmp : a.order - b.order;
  });
}

/**
 * When sortBy is 'manual', returns `columns` unchanged (same references).
 * Otherwise, maps each column spreading its cards with sortCards(column.cards, sortBy).
 */
export function sortColumns(
  columns: FilteredColumn[],
  sortBy: SortBy,
): FilteredColumn[] {
  if (sortBy === "manual") return columns;
  return columns.map((col) => ({ ...col, cards: sortCards(col.cards, sortBy) }));
}
