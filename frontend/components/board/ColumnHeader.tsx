"use client";

import { useId, useState } from "react";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";

export interface ColumnHeaderProps {
  title: string;
  cardCount: number;
  /** Called with the new trimmed name when the user commits an inline rename. */
  onRename?: (newTitle: string) => void;
  /** Called when the user activates the delete column action. */
  onColumnDelete?: () => void;
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
  onRename,
  onColumnDelete,
}: ColumnHeaderProps) {
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
    <header className="flex items-center justify-between gap-2 px-1 pb-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
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
            className="min-w-0 truncate text-left text-sm font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={onRename ? "Click to rename" : undefined}
          >
            {title}
          </button>
        )}

        <BaseBadge aria-label={`${cardCount} ${cardCount === 1 ? "card" : "cards"}`}>
          {cardCount}
        </BaseBadge>
      </div>

      {onColumnDelete && (
        <BaseButton
          variant="secondary"
          size="icon"
          onClick={onColumnDelete}
          aria-label={`Delete column: ${title}`}
          className="shrink-0 !border-0 !bg-transparent text-muted-foreground hover:text-destructive"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5A.75.75 0 0 1 9.95 6Z"
              clipRule="evenodd"
            />
          </svg>
        </BaseButton>
      )}
    </header>
  );
}
