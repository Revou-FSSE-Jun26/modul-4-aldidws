import type { Card } from "@/lib/types/api";
import type { FilteredColumn } from "@/lib/filterCards";

export type GroupBy = "none" | "priority";

/** Priority groups in display order. */
export const PRIORITY_GROUPS = [
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
  { key: null, label: "No priority" },
] as const;

export type PriorityGroupKey = "high" | "medium" | "low" | null;

export interface PriorityGroup {
  key: PriorityGroupKey;
  label: string;
  /** Columns with only the cards belonging to this priority group. */
  columns: FilteredColumn[];
}

/**
 * Groups columns by card priority for the Kanban view.
 * Each column in the returned groups contains only the cards of that priority.
 * Groups with no cards across all columns are omitted.
 *
 * @param columns - Already-filtered and sorted columns.
 */
export function groupByPriority(columns: FilteredColumn[]): PriorityGroup[] {
  const groups: PriorityGroup[] = [];

  for (const { key, label } of PRIORITY_GROUPS) {
    const groupColumns: FilteredColumn[] = columns.map((col) => ({
      ...col,
      cards: col.cards.filter((card: Card) => card.priority === key),
      // Preserve original total so the filter badge still reflects the full column count.
      total: col.total,
    }));

    const hasAnyCard = groupColumns.some((col) => col.cards.length > 0);
    if (hasAnyCard) {
      groups.push({ key, label, columns: groupColumns });
    }
  }

  return groups;
}

/**
 * Groups a flat list of cards by priority for the List view.
 * All groups are returned (even empty ones), in the same display order.
 */
export function groupCardsByPriority(cards: (Card & { columnName: string })[]): {
  key: PriorityGroupKey;
  label: string;
  cards: (Card & { columnName: string })[];
}[] {
  return PRIORITY_GROUPS.map(({ key, label }) => ({
    key,
    label,
    cards: cards.filter((c) => c.priority === key),
  }));
}
