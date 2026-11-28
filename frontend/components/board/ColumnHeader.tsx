"use client";

import { useId, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { ActionMenu, type ActionMenuItem } from "@/components/shared/ActionMenu";
import { COLUMN_COLORS } from "@/lib/columnColor";
import type { ColumnColor } from "@/lib/types/api";

export interface ColumnHeaderProps {
  title: string;
  cardCount: number;
  visibleCount?: number;
  totalCount?: number;
  onRename?: (newTitle: string) => void;
  onColumnDelete?: () => void;
  reorder?: ColumnReorderHandle;
  status?: ColumnColor;
  color?: ColumnColor | null;
  onColorChange?: (color: ColumnColor | null) => void;
  isDone?: boolean;
  onDoneChange?: (isDone: boolean) => void;
  actionsDisabled?: boolean;
  onAddTask?: () => void;
  addTaskButtonRef?: React.Ref<HTMLButtonElement>;
}

export interface ColumnReorderHandle {
  columnId: string;
  onDragStart: (e: React.DragEvent<HTMLElement>, columnId: string) => void;
  onDragEnd: () => void;
  onMove: (direction: -1 | 1) => void;
}

const MAX_COLUMN_TITLE_LENGTH = 100;

const DOT_COLORS: Record<ColumnColor, string> = {
  gray: "bg-[#89938C]",
  blue: "bg-[#4D91C7]",
  orange: "bg-[#D69A27]",
  green: "bg-[#64975D]",
  red: "bg-[#9A69B7]",
};

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
  const isFiltered =
    visibleCount !== undefined && totalCount !== undefined;

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

  function commitRename() {
    const trimmed = draft.trim();

    if (!trimmed) {
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
    event.stopPropagation();

    if (event.key === "Enter") {
      event.preventDefault();
      commitRename();
    }

    if (event.key === "Escape") {
      cancelEditing();
    }
  }

  const menuItems: ActionMenuItem[] = [];

  if (onRename) {
    menuItems.push({
      id: "rename",
      label: "Rename",
      onSelect: startEditing,
    });
  }

  if (reorder) {
    menuItems.push(
      {
        id: "move-left",
        label: "Move left",
        disabled: actionsDisabled,
        onSelect: () => reorder.onMove(-1),
      },
      {
        id: "move-right",
        label: "Move right",
        disabled: actionsDisabled,
        onSelect: () => reorder.onMove(1),
      },
    );
  }

  if (onColorChange) {
    const options: { value: ColumnColor | null; label: string }[] = [
      { value: null, label: "Automatic" },
      ...COLUMN_COLORS.map((c) => ({
        value: c,
        label: c.charAt(0).toUpperCase() + c.slice(1),
      })),
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
      label: isDone ? "Unmark done column" : "Mark as done column",
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

  return (
    <header
      data-status={status}
      className="flex min-w-0 items-center justify-between gap-1.5 sm:gap-2"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
        {!isEditing && (
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              status ? DOT_COLORS[status] : "bg-[#89938C]"
            }`}
          />
        )}

        {isEditing ? (
          <div className="flex min-w-0 flex-1 flex-col gap-1">
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
              className="min-h-8 w-full rounded-md border border-[#B8C8B9] bg-white px-2 py-1 text-base font-semibold text-[#244438] outline-none transition-colors hover:border-[#8FA994] focus:ring-2 focus:ring-[#A9C3AE] sm:min-h-0 sm:text-xs"
            />

            {error && (
              <p id={errorId} role="alert" className="text-xs text-red-600">
                {error}
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            aria-label={onRename ? `Rename column: ${title}` : title}
            title={onRename ? "Click to rename" : undefined}
            className={`min-h-7 min-w-0 touch-manipulation truncate rounded px-1 py-1 -ml-1 text-left text-[13px] font-semibold text-[#344D40] transition-colors hover:bg-[#EBF0E2] hover:text-[#16382C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AA995] sm:min-h-0 sm:py-0.5 sm:text-[12px] ${
              onRename ? "cursor-pointer" : "cursor-default"
            }`}
          >
            {title}
          </button>
        )}

        <span className="shrink-0">
          <BaseBadge
            aria-label={
              isFiltered
                ? `${visibleCount} of ${totalCount} cards shown`
                : `${cardCount} cards`
            }
          >
            {isFiltered ? visibleCount : cardCount}
          </BaseBadge>
        </span>

        {isDone && (
          <span
            title="Done column"
            className="inline-flex shrink-0 items-center gap-0.5 rounded bg-[#2D6A4F]/12 px-1.5 py-0.5 text-[9px] font-semibold text-[#1D4E38]"
          >
            <CheckCircle2 size={10} aria-hidden="true" />
            <span>Done</span>
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        {onAddTask && (
          <button
            type="button"
            ref={addTaskButtonRef}
            onClick={onAddTask}
            aria-label={`Add task to top of ${title}`}
            title="Add task"
            className="flex h-8 w-8 touch-manipulation cursor-pointer items-center justify-center rounded-md text-[#65776A] transition-colors hover:bg-[#EBF0E2] hover:text-[#16382C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AA995] sm:h-6 sm:w-6"
          >
            <span className="text-lg leading-none" aria-hidden="true">
              +
            </span>
          </button>
        )}

        {menuItems.length > 0 && (
          <div className="[&>button]:h-8 [&>button]:w-8 sm:[&>button]:h-6 sm:[&>button]:w-6 [&_button]:touch-manipulation [&_button]:cursor-pointer [&_button:hover]:bg-[#EBF0E2] [&_button:hover]:text-[#16382C] [&_a]:cursor-pointer [&_a:hover]:bg-[#EBF0E2] [&_a:hover]:text-[#16382C] [&_div[role='menu']>button]:cursor-pointer [&_div[role='menu']>button:hover]:bg-[#EBF0E2] [&_div[role='menu']>button:hover]:text-[#16382C] [&_div[role='menuitem']]:cursor-pointer [&_div[role='menuitem']:hover]:bg-[#EBF0E2] [&_div[role='menuitem']:hover]:text-[#16382C] [&_div[role='menuitemradio']]:cursor-pointer [&_div[role='menuitemradio']:hover]:bg-[#EBF0E2] [&_div[role='menuitemradio']:hover]:text-[#16382C]">
            <ActionMenu
              label={`Column actions for ${title}`}
              items={menuItems}
            />
          </div>
        )}
      </div>
    </header>
  );
}