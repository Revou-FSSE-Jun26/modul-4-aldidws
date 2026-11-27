import type { Card, ColumnWithCards } from "@/lib/types/api";

export type DueFilter = "any" | "overdue" | "today" | "24h" | "7d" | "none";

export type PriorityFilter = "any" | "low" | "medium" | "high";

export interface CardFilters {
  keyword: string;
  labelIds: string[];
  due: DueFilter;
  priority: PriorityFilter;
}

export const EMPTY_FILTERS: CardFilters = {
  keyword: "",
  labelIds: [],
  due: "any",
  priority: "any",
};

export interface FilteredColumn extends ColumnWithCards {
  /** Number of cards in the column before filtering. */
  total: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Number of filters that currently narrow the board (keyword, labels, due, priority). */
export function countActiveFilters(filters: CardFilters): number {
  return (
    (filters.keyword.trim() !== "" ? 1 : 0) +
    (filters.labelIds.length > 0 ? 1 : 0) +
    (filters.due !== "any" ? 1 : 0) +
    (filters.priority !== "any" ? 1 : 0)
  );
}

/** True when the card passes every active filter (AND; labels use ANY). */
export function matchesFilters(
  card: Card,
  filters: CardFilters,
  now: Date,
  isDoneColumn = false,
): boolean {
  const keyword = filters.keyword.trim().toLowerCase();
  if (keyword !== "") {
    const inTitle = card.title.toLowerCase().includes(keyword);
    const inDescription = (card.description ?? "").toLowerCase().includes(keyword);
    if (!inTitle && !inDescription) return false;
  }

  if (filters.labelIds.length > 0) {
    if (!card.labels.some((label) => filters.labelIds.includes(label.id))) return false;
  }

  if (filters.due !== "any") {
    if (filters.due === "none") {
      if (card.due_date !== null) return false;
    } else if (card.due_date === null) {
      return false;
    } else {
      const due = Date.parse(card.due_date);
      if (Number.isNaN(due)) return false;
      const nowMs = now.getTime();
      if (filters.due === "overdue") {
        if (!(due < nowMs && !isDoneColumn)) return false;
      } else if (filters.due === "today") {
        const dueDate = new Date(due);
        const sameDate =
          dueDate.getFullYear() === now.getFullYear() &&
          dueDate.getMonth() === now.getMonth() &&
          dueDate.getDate() === now.getDate();
        if (!sameDate) return false;
      } else {
        const windowMs = filters.due === "24h" ? DAY_MS : 7 * DAY_MS;
        if (!(due >= nowMs && due <= nowMs + windowMs)) return false;
      }
    }
  }

  if (filters.priority !== "any") {
    if (card.priority !== filters.priority) return false;
  }

  return true;
}

/** Returns new column objects holding only matching cards. Inputs are not mutated. */
export function filterColumns(
  columns: ColumnWithCards[],
  filters: CardFilters,
  now: Date,
): FilteredColumn[] {
  return columns.map((column) => ({
    ...column,
    cards: column.cards.filter((card) => matchesFilters(card, filters, now, column.is_done)),
    total: column.cards.length,
  }));
}
