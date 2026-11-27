import { type ReactNode } from "react";
import Link from "next/link";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { BaseButton } from "@/components/shared/BaseButton";

export interface CardMenuHandlers {
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** True while the duplicate request is in-flight; disables the Duplicate item. */
  isDuplicating?: boolean;
}

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
  /**
   * Priority level for the card. When present, a plain-text indicator is
   * rendered above the meta block with `data-priority` for styling hooks.
   */
  priority?: "low" | "medium" | "high";
  /** Name of the board this card belongs to. Shown above the title when provided. */
  boardName?: string;
  /**
   * When provided, renders a kebab ActionMenu (`...`) with Edit / Duplicate / Delete items.
   * The existing `×` delete button (onCardDelete) is independent and unchanged.
   */
  onCardMenu?: CardMenuHandlers;
  /**
   * When true, adds `data-done="true"` to the card title element.
   * The design layer will apply strikethrough styling via this attribute.
   */
  isDoneColumn?: boolean;
  /** True while this card is being dragged; adds the lift+tilt styling hook. */
  isDragging?: boolean;
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
  priority,
  boardName,
  onCardMenu,
  isDoneColumn,
  isDragging,
}: BoardCardProps) {
  const openClasses =
    "block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)] focus-visible:ring-offset-1";

  const priorityIndicator = priority ? (
    <span data-priority={priority} className="text-xs text-[var(--text-muted)]">
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  ) : null;

  // Right-pad the card body when an action button occupies the top-right corner.
  const hasActionButton = Boolean(onCardDelete) || Boolean(onCardMenu);

  return (
    <article className="board-card relative flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 shadow-[var(--shadow-card)]">
      {priorityIndicator}
      {boardName && (
        <span aria-label={`Board: ${boardName}`} className="text-xs text-[var(--text-muted)]">
          {boardName}
        </span>
      )}
      {href ? (
        <>
          <Link href={href} id={openId} className={openClasses}>
            <span
              className="text-sm font-medium text-[var(--text-primary)]"
              {...(isDoneColumn ? { "data-done": "true" } : {})}
            >
              {title}
            </span>
          </Link>
          {meta && <div className="mt-1">{meta}</div>}
        </>
      ) : (
        // Plain <button> kept on purpose: this is the whole tile acting as
        // a click target, not a visual button, so BaseButton styling does not apply.
        <>
          <button
            type="button"
            id={openId}
            onClick={onCardClick}
            className={`${openClasses} ${hasActionButton ? "pr-10" : ""}`}
            aria-label={`Open card: ${title}`}
          >
            <p
              className="text-sm font-medium text-[var(--text-primary)]"
              {...(isDoneColumn ? { "data-done": "true" } : {})}
            >
              {title}
            </p>
          </button>
          {/* Outside the button so the aria-label does not hide the badge text. */}
          {meta && <div className={`mt-1 ${hasActionButton ? "pr-10" : ""}`}>{meta}</div>}
        </>
      )}

      {/* Delete action — always visible so it works on touch screens */}
      {onCardDelete && (
        <BaseButton
          variant="secondary"
          size="icon"
          onClick={onCardDelete}
          aria-label={`Delete card: ${title}`}
          className="absolute right-1 top-1 !border-0 !bg-transparent text-[var(--text-muted)] hover:text-[var(--accent-red)]"
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

      {/* Kebab action menu (Edit / Duplicate / Delete) */}
      {onCardMenu && (
        // draggable=false + stopPropagation on dragstart prevents the parent <li>
        // drag from activating when the user clicks the trigger button.
        <div
          className="absolute right-1 top-1"
          draggable={false}
          onDragStart={(e) => e.stopPropagation()}
        >
          <ActionMenu
            label={`Card actions for ${title}`}
            items={[
              {
                id: "edit",
                label: "Edit",
                disabled: Boolean(onCardMenu.isDuplicating),
                onSelect: onCardMenu.onEdit,
              },
              {
                id: "duplicate",
                label: "Duplicate",
                disabled: Boolean(onCardMenu.isDuplicating),
                onSelect: onCardMenu.onDuplicate,
              },
              {
                id: "delete",
                label: "Delete",
                disabled: Boolean(onCardMenu.isDuplicating),
                onSelect: onCardMenu.onDelete,
              },
            ]}
          />
        </div>
      )}
    </article>
  );
}
