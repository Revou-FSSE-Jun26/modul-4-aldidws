import { type ReactNode } from "react";

export interface BoardCardProps {
  title: string;
  /** Optional badge or metadata rendered beneath the title. */
  meta?: ReactNode;
  /** Called when the user clicks anywhere on the card body. */
  onCardClick?: () => void;
  /** Called when the user activates the delete action. */
  onCardDelete?: () => void;
}

/**
 * Presentational card tile rendered inside a board column.
 * Receives all data and callbacks from its parent — contains no data-fetching
 * or mutation logic.
 */
export function BoardCard({
  title,
  meta,
  onCardClick,
  onCardDelete,
}: BoardCardProps) {
  return (
    <article className="group relative flex flex-col gap-1 rounded-md border border-border bg-card px-3 py-2 shadow-sm">
      {/* Clickable card body */}
      <button
        type="button"
        onClick={onCardClick}
        className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        aria-label={`Open card: ${title}`}
      >
        <p className="text-sm font-medium text-foreground">{title}</p>
        {meta && <div className="mt-1">{meta}</div>}
      </button>

      {/* Delete action — only visible on hover / focus-within */}
      {onCardDelete && (
        <button
          type="button"
          onClick={onCardDelete}
          aria-label={`Delete card: ${title}`}
          className="absolute right-2 top-2 hidden rounded p-0.5 text-muted-foreground hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:flex group-focus-within:flex"
        >
          {/* ✕ icon — inline SVG avoids an icon-library dependency */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
          </svg>
        </button>
      )}
    </article>
  );
}
