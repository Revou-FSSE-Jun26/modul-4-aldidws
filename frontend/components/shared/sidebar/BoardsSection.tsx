import type { Board } from "@/lib/types/api";
import { SectionHeader } from "./SectionHeader";
import { BoardsList } from "./BoardsList";

interface BoardsSectionProps {
  label: string;
  boards: Board[];
  open: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onToggleFavorite: (board: Board) => Promise<void>;
  emptyMessage?: string;
}

/**
 * Collapsible section for displaying boards (Favorites or Projects).
 */
export function BoardsSection({
  label,
  boards,
  open,
  collapsed,
  onToggle,
  onToggleFavorite,
  emptyMessage = "No boards yet",
}: BoardsSectionProps) {
  return (
    <section className={label === "Favorites" ? "mt-2" : "mt-1"}>
      <SectionHeader label={label} open={open} collapsed={collapsed} onToggle={onToggle} />

      <div
        className={[
          "overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out",
          collapsed || !open ? "max-h-0 opacity-0" : label === "Favorites" ? "max-h-60 opacity-100" : "max-h-56 opacity-100",
        ].join(" ")}
      >
        <ul
          role="list"
          className={[
            "mt-0.5 flex flex-col gap-0.5 pl-3 pr-0.5",
            label === "Projects" ? "max-h-48 overflow-y-auto" : "",
          ].join(" ")}
        >
          {!collapsed && boards.length === 0 ? (
            <li className="px-2 py-1 text-xs text-[var(--text-muted)]">{emptyMessage}</li>
          ) : (
            <BoardsList boards={boards} collapsed={collapsed} onToggleFavorite={onToggleFavorite} />
          )}
        </ul>
      </div>
    </section>
  );
}
