"use client";

import { useId, useState } from "react";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { ActionMenu, type ActionMenuItem } from "@/components/shared/ActionMenu";
import { COLUMN_COLORS } from "@/lib/columnColor";
import type { ColumnColor } from "@/lib/types/api";

export interface ColumnHeaderProps {
  title: string;
  cardCount: number;
  /** While filters are active: cards shown and cards in the column ("x of y"). */
  visibleCount?: number;
  totalCount?: number;
  /** Called with the new trimmed name when the user commits an inline rename. */
  onRename?: (newTitle: string) => void;
  /** Called when the user activates the delete column action. */
  onColumnDelete?: () => void;
  /** Column reorder handle. Omit to hide the handle. */
  reorder?: ColumnReorderHandle;
  /** Resolved status color, exposed as `data-status` for later styling. */
  status?: ColumnColor;
  /** Stored color choice (null = automatic). Marks the checked menu option. */
  color?: ColumnColor | null;
  /** Called when the user picks a status color; null means automatic. */
  onColorChange?: (color: ColumnColor | null) => void;
  /** Whether the column is a Done column, exposed as `data-done`. */
  isDone?: boolean;
  /** Called with the new Done flag when the user toggles it in the menu. */
  onDoneChange?: (isDone: boolean) => void;
  /** Disables the menu actions while a request is in flight. */
  actionsDisabled?: boolean;
  /** Called when the user activates the + button. Omit to hide the button. */
  onAddTask?: () => void;
  /** Receives the + button so the column can return focus to it. */
  addTaskButtonRef?: React.Ref<HTMLButtonElement>;
}

export interface ColumnReorderHandle {
  /** Used as `data-column-handle` so the board can restore focus after a move. */
  columnId: string;
  onDragStart: (e: React.DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  /** -1 moves the column left, 1 moves it right. */
  onMove: (direction: -1 | 1) => void;
}

const MAX_COLUMN_TITLE_LENGTH = 100;

/**
 * Column heading displayed above a board column's card list.
 * Click the title to rename it inline, with an optional delete action.
 * Uses `"use client"` because it manages local editing state.
 */
export function ColumnHeader({
  title,
  cardCount,
  visibleCount,
  totalCount,
  onRename,
  onColumnDelete,
  reorder,
  status,
  color = null,
  onColorChange,
  isDone = false,
  onDoneChange,
  actionsDisabled = false,
  onAddTask,
  addTaskButtonRef,
}: ColumnHeaderProps) {
  const isFiltered = visibleCount !== undefined && totalCount !== undefined;
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    if (!onRename) return;
    setDraft(title);
    setError(null);
    setIsEditing(true);
  }

  const menuItems: ActionMenuItem[] = [];
  if (onRename) {
    menuItems.push({ id: "rename", label: "Rename", onSelect: startEditing });
  }
  if (onColorChange) {
    const options: { value: ColumnColor | null; label: string }[] = [
      { value: null, label: "Automatic" },
      ...COLUMN_COLORS.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
    ];
    for (const option of options) {
      menuItems.push({
        id: `color-${option.value ?? "auto"}`,
        label: option.label,
        role: "menuitemradio",
        checked: color === option.value,
        value: option.value ?? "auto",
        disabled: actionsDisabled,
        onSelect: () => onColorChange(option.value),
      });
    }
  }
  if (onDoneChange) {
    menuItems.push({
      id: "done",
      label: isDone ? "Unmark Done column" : "Mark as Done column",
      disabled: actionsDisabled,
      onSelect: () => onDoneChange(!isDone),
    });
  }
  if (onColumnDelete) {
    menuItems.push({
      id: "delete",
      label: "Delete column",
      disabled: actionsDisabled,
      onSelect: onColumnDelete,
    });
  }

  function commitRename() {
    const trimmed = draft.trim();

    if (trimmed.length === 0) {
      setError("Column name cannot be empty.");
      return;
    }

    if (trimmed.length > MAX_COLUMN_TITLE_LENGTH) {
      setError(`Column name must be ${MAX_COLUMN_TITLE_LENGTH} characters or fewer.`);
      return;
    }

    if (trimmed !== title) onRename?.(trimmed);
    setIsEditing(false);
    setError(null);
  }

  function cancelEditing() {
    setDraft(title);
    setError(null);
    setIsEditing(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRename();
    }
    if (event.key === "Escape") {
      cancelEditing();
    }
  }

  return (
    <header data-status={status} data-done={String(isDone)} className="flex items-center justify-between gap-2 px-1 pb-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {reorder && (
          <button
            type="button"
            draggable
            data-column-handle={reorder.columnId}
            aria-label={`Reorder column ${title}`}
            title="Drag, or press the left and right arrow keys, to reorder"
            onDragStart={reorder.onDragStart}
            onDragEnd={reorder.onDragEnd}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                reorder.onMove(e.key === "ArrowLeft" ? -1 : 1);
              }
            }}
            className="shrink-0 cursor-grab text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden="true">&#8942;&#8942;</span>
          </button>
        )}
        {isEditing ? (
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor={inputId} className="sr-only">
              Column name
            </label>
            <input
              id={inputId}
              type="text"
              value={draft}
              autoFocus
              onChange={(e) => {
                setDraft(e.target.value);
                if (error) setError(null);
              }}
              onBlur={commitRename}
              onKeyDown={handleKeyDown}
              maxLength={MAX_COLUMN_TITLE_LENGTH + 1}
              aria-invalid={error !== null}
              aria-describedby={error ? errorId : undefined}
              className="w-full rounded border border-border bg-background px-2 py-0.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {error && (
              <p id={errorId} role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
        ) : (
          // Plain <button> kept on purpose: the title only looks like text and
          // acts as the rename trigger, so BaseButton styling does not apply.
          <button
            type="button"
            onClick={startEditing}
            aria-label={onRename ? `Rename column: ${title}` : title}
            className="col-status-pill min-w-0 truncate rounded-[var(--radius-pill)] px-2 py-0.5 text-left text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={onRename ? "Click to rename" : undefined}
          >
            {title}
          </button>
        )}

        {isFiltered ? (
          <BaseBadge aria-label={`${visibleCount} of ${totalCount} cards shown`}>
            {visibleCount} of {totalCount}
          </BaseBadge>
        ) : (
          <BaseBadge aria-label={`${cardCount} ${cardCount === 1 ? "card" : "cards"}`}>
            {cardCount}
          </BaseBadge>
        )}
      </div>

      {onAddTask && (
        <button
          type="button"
          ref={addTaskButtonRef}
          onClick={onAddTask}
          aria-label={`Add task to top of ${title}`}
          title="Add a task to the top of this column"
          className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden="true">+</span>
        </button>
      )}
      {menuItems.length > 0 && (
        <ActionMenu label={`Column actions for ${title}`} items={menuItems} />
      )}
    </header>
  );
}
