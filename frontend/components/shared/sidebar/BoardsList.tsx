import Link from "next/link";
import { Star } from "lucide-react";
import type { Board } from "@/lib/types/api";

interface BoardsListProps {
  boards: Board[];
  collapsed: boolean;
  onToggleFavorite: (board: Board) => Promise<void>;
}

/**
 * List of boards with favorite toggle functionality.
 */
export function BoardsList({ boards, collapsed, onToggleFavorite }: BoardsListProps) {
  if (collapsed) {
    return null;
  }

  if (boards.length === 0) {
    return (
      <li className="px-2 py-1 text-xs text-[var(--text-muted)]">No boards yet</li>
    );
  }

  function handleFavoriteClick(board: Board) {
    onToggleFavorite(board).catch(() => {
      // Error is handled silently - state remains unchanged
    });
  }

  return (
    <>
      {boards.map((board) => (
        <li key={board.id} className="flex items-center gap-1">
          <Link
            href={`/boards/${board.id}`}
            className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-[13px] text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--bg-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)]"
          >
            {board.name}
          </Link>
          <button
            type="button"
            aria-label={board.is_favorite ? "Remove from favorites" : "Add to favorites"}
            onClick={() => handleFavoriteClick(board)}
            className={[
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors duration-150",
              "hover:bg-[var(--bg-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)]",
              board.is_favorite ? "text-[var(--pill-orange)]" : "text-[var(--text-muted)]",
            ].join(" ")}
          >
            <Star
              size={13}
              strokeWidth={1.5}
              aria-hidden="true"
              className={board.is_favorite ? "fill-[var(--pill-orange)]" : ""}
            />
          </button>
        </li>
      ))}
    </>
  );
}
