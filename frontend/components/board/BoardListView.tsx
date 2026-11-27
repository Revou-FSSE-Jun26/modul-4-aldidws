"use client";

import { Fragment } from "react";
import { formatDue } from "@/lib/dueDate";
import { sortCards } from "@/lib/sortCards";
import { groupCardsByPriority } from "@/lib/groupCards";
import type { Card, ColumnWithCards } from "@/lib/types/api";
import type { SortBy } from "@/lib/sortCards";
import type { GroupBy } from "@/lib/groupCards";
import { LabelPill } from "@/components/board/LabelPill";

export interface BoardListViewProps {
  /** Columns already filtered; each column.cards holds only matching cards. */
  columns: ColumnWithCards[];
  /** Current sort mode; manual means column-position then card.order. */
  sortBy: SortBy;
  /** Current group-by mode. */
  groupBy: GroupBy;
  /** Called when a row is clicked. */
  onOpenCard: (card: Card) => void;
}

/**
 * Flat table view of all visible cards across columns.
 *
 * Rows are ordered by:
 *  - non-manual sortBy  → sortCards() across all cards
 *  - manual             → column position (ascending), then card.order (ascending)
 */
export function BoardListView({ columns, sortBy, groupBy, onOpenCard }: BoardListViewProps) {
  // Build a flat list respecting sort order.
  type RowCard = Card & { columnName: string };

  let rows: RowCard[];

  if (sortBy === "manual") {
    // Sort by column position (already sorted by position in BoardDetailView),
    // then by card order within each column.
    rows = columns.flatMap((col) =>
      [...col.cards]
        .sort((a, b) => a.order - b.order)
        .map((c) => ({ ...c, columnName: col.name })),
    );
  } else {
    // Collect all cards, sort globally, then look up column name.
    const colNameById: Record<string, string> = {};
    for (const col of columns) colNameById[col.id] = col.name;
    const allCards = columns.flatMap((col) => col.cards);
    const sorted = sortCards(allCards, sortBy);
    rows = sorted.map((c) => ({ ...c, columnName: colNameById[c.column_id] ?? "" }));
  }

  if (rows.length === 0) {
    return (
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-[13px] text-[var(--text-muted)]">No tasks</p>
      </div>
    );
  }

  const groups =
    groupBy === "priority"
      ? groupCardsByPriority(rows)
      : [{ key: null, label: "", cards: rows }];

  return (
    <div className="overflow-x-auto px-4 py-4 sm:px-6 lg:px-8">
      <table
        aria-label="Task list"
        className="w-full border-collapse text-[13px] text-[var(--text-primary)]"
      >
        <caption className="sr-only">Task list</caption>
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-panel)] text-left text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            <th scope="col" className="py-2 px-3">Task</th>
            <th scope="col" className="py-2 px-3">Column</th>
            <th scope="col" className="py-2 px-3">Priority</th>
            <th scope="col" className="py-2 px-3">Due date</th>
            <th scope="col" className="py-2 px-3">Labels</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const groupRows =
              groupBy === "priority" ? group.cards : rows;
            return (
              <Fragment key={groupBy === "priority" ? (group.label || "none") : "all"}>
                {groupBy === "priority" && (
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={5}
                      data-group={group.key ?? "none"}
                      className="sticky top-0 border-b border-[var(--border)] bg-[var(--bg-panel)] py-2 px-3 text-left text-[12px] font-semibold text-[var(--text-secondary)]"
                    >
                      {group.label} ({group.cards.length})
                    </th>
                  </tr>
                )}
                {groupRows.map((card) => (
                  <tr
                    key={card.id}
                    onClick={() => onOpenCard(card)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpenCard(card);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open card: ${card.title}`}
                    className="cursor-pointer border-b border-[var(--border)] hover:bg-[var(--bg-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)]"
                  >
                    <td className="py-2 px-3 font-medium text-[var(--text-primary)]">{card.title}</td>
                    <td className="py-2 px-3 text-[var(--text-secondary)]" data-column-name={card.columnName}>
                      {card.columnName}
                    </td>
                    <td className="py-2 px-3">
                      {card.priority ? (
                        <span data-priority={card.priority} className="list-prio-dot text-[12px] text-[var(--text-muted)]">
                          {card.priority.charAt(0).toUpperCase() + card.priority.slice(1)}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 px-3 text-[12px] text-[var(--text-muted)]">
                      {card.due_date ? formatDue(card.due_date) : null}
                    </td>
                    <td className="py-2 px-3">
                      {card.labels.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {card.labels.map((label) => (
                            <LabelPill key={label.id} name={label.name} color={label.color} />
                          ))}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
