import { type ReactNode } from "react";
import Link from "next/link";
import { BaseButton } from "@/components/shared/BaseButton";

export interface BoardCardProps {
  title: string;
  /** Optional badge or metadata rendered beneath the title. */
  meta?: ReactNode;
  /** Called when the user clicks anywhere on the card body. */
  onCardClick?: () => void;
  /** Called when the user activates the delete action. */
  onCardDelete?: () => void;
  /**
   * When set, the title is rendered as a real link (accessible name is the
   * title) instead of an "Open card" button.
   */
  href?: string;
  /** Optional id for the open link or button, used to restore focus. */
  openId?: string;
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
  href,
  openId,
}: BoardCardProps) {
  const openClasses =
    "block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

  return (
    <article className="relative flex flex-col gap-1 rounded-md border border-border bg-card px-3 py-2 shadow-sm">
      {href ? (
        <>
          <Link href={href} id={openId} className={openClasses}>
            <span className="text-sm font-medium text-foreground">{title}</span>
          </Link>
          {meta && <div className="mt-1">{meta}</div>}
        </>
      ) : (
        // Plain <button> kept on purpose: this is the whole tile acting as
        // a click target, not a visual button, so BaseButton styling does not apply.
        <button
          type="button"
          id={openId}
          onClick={onCardClick}
          className={`${openClasses} ${onCardDelete ? "pr-10" : ""}`}
          aria-label={`Open card: ${title}`}
        >
          <p className="text-sm font-medium text-foreground">{title}</p>
          {meta && <div className="mt-1">{meta}</div>}
        </button>
      )}

      {/* Delete action — always visible so it works on touch screens */}
      {onCardDelete && (
        <BaseButton
          variant="secondary"
          size="icon"
          onClick={onCardDelete}
          aria-label={`Delete card: ${title}`}
          className="absolute right-1 top-1 !border-0 !bg-transparent text-muted-foreground hover:text-destructive"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
          </svg>
        </BaseButton>
      )}
    </article>
  );
}
