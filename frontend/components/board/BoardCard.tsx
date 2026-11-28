import { type ReactNode } from "react";
import Link from "next/link";
import { Calendar, Check, MessageCircle } from "lucide-react";

export interface CardMenuHandlers {
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  isDuplicating?: boolean;
}

export interface BoardCardProps {
  title: string;
  description?: string | null;
  dueDateLabel?: string | null;
  commentsCount?: number;
  assigneeName?: string | null;
  meta?: ReactNode;
  onCardClick?: () => void;
  onCardDelete?: () => void;
  href?: string;
  openId?: string;
  priority?: "low" | "medium" | "high";
  boardName?: string;
  onCardMenu?: CardMenuHandlers;
  isDoneColumn?: boolean;
  isDragging?: boolean;
}

const PRIORITY_STYLES: Record<"low" | "medium" | "high", string> = {
  low: "text-[#678870]",
  medium: "text-[#B58A3B]",
  high: "text-[#C46F56]",
};

export function BoardCard({
  title,
  description,
  dueDateLabel,
  commentsCount,
  assigneeName,
  meta,
  onCardClick,
  href,
  openId,
  priority,
  isDoneColumn,
  isDragging,
}: BoardCardProps) {
  const openClasses =
    "block w-full touch-manipulation cursor-pointer rounded-md text-left no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AA995] focus-visible:ring-offset-2";

  const trimmedDescription = description?.trim();
  const hasComments = typeof commentsCount === "number" && commentsCount > 0;

  const bodyContent = (
    <div className="flex flex-col gap-1.5 no-underline">
      <div className="flex items-start justify-between gap-2">
        <span className="block min-w-0 flex-1 break-words text-sm font-semibold leading-snug text-[#173B30] no-underline sm:text-[15px]">
          {title}
        </span>

        {isDoneColumn && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#DCE5CC] px-2 py-0.5 text-[10px] font-semibold text-[#16382C] no-underline">
            <Check size={11} strokeWidth={2.2} aria-hidden="true" />
            <span>Done</span>
          </span>
        )}
      </div>

      {trimmedDescription && (
        <div className="group/desc -mx-1.5 rounded-md px-1.5 py-0.5 transition-colors duration-150 hover:bg-[#F3F6EE]">
          <p className="line-clamp-2 break-words text-xs leading-relaxed text-[#6E7A73] no-underline transition-colors duration-150 group-hover/desc:text-[#173B30] sm:text-[12.5px]">
            {trimmedDescription}
          </p>
        </div>
      )}
    </div>
  );

  const hasFooterMeta =
    Boolean(dueDateLabel) ||
    hasComments ||
    Boolean(assigneeName);

  return (
    <article
      className={[
        "board-card flex flex-col gap-2 no-underline sm:gap-2.5",
        "rounded-xl border",
        isDoneColumn
          ? "border-[#C7D5BC] bg-[#FAFBF8]"
          : "border-[#DCE6F0] bg-white",
        "px-3 py-3 sm:px-4 sm:py-3.5",
        "shadow-[0_1px_2px_rgba(23,59,48,0.03)]",
        "transition-colors duration-150",
        "hover:border-[#B6C8B2]",
        isDragging ? "rotate-1 opacity-75" : "",
      ].join(" ")}
    >
      {/* Top row: color label strips on the left, priority indicator on the right */}
      {(meta || priority) && (
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 pt-0.5">
            {meta}
          </div>
          {priority && (
            <span
              data-priority={priority}
              className={`inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium no-underline sm:text-[12px] ${PRIORITY_STYLES[priority]}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              <span>{priority.charAt(0).toUpperCase() + priority.slice(1)}</span>
            </span>
          )}
        </div>
      )}

      {/* Title & short description */}
      {href ? (
        <Link href={href} id={openId} className={openClasses}>
          {bodyContent}
        </Link>
      ) : (
        <button
          type="button"
          id={openId}
          onClick={onCardClick}
          className={openClasses}
          aria-label={`Open card: ${title}`}
        >
          {bodyContent}
        </button>
      )}

      {/* Bottom meta row: due date (left), comment count (center), assignee (right) */}
      {hasFooterMeta && (
        <div className="grid grid-cols-3 items-center gap-1.5 pt-1 text-[11px] text-[#6E7A73] no-underline sm:gap-2 sm:text-[12px]">
          <div className="flex min-w-0 items-center justify-start">
            {dueDateLabel && (
              <span className="inline-flex min-w-0 items-center gap-1 no-underline sm:gap-1.5">
                <Calendar
                  size={13}
                  strokeWidth={1.75}
                  className="shrink-0 text-[#7C8780] sm:h-3.5 sm:w-3.5"
                  aria-hidden="true"
                />
                <span className="truncate">{dueDateLabel}</span>
              </span>
            )}
          </div>

          <div className="flex items-center justify-center">
            {hasComments && (
              <span
                className="inline-flex items-center gap-1 no-underline sm:gap-1.5"
                aria-label={`${commentsCount} comments`}
              >
                <MessageCircle
                  size={13}
                  strokeWidth={1.75}
                  className="shrink-0 text-[#7C8780] sm:h-3.5 sm:w-3.5"
                  aria-hidden="true"
                />
                <span>{commentsCount}</span>
              </span>
            )}
          </div>

          <div className="flex min-w-0 items-center justify-end">
            {assigneeName && (
              <span className="truncate font-medium text-[#5E6B64] no-underline">
                {assigneeName}
              </span>
            )}
          </div>
        </div>
      )}
    </article>
  );
}