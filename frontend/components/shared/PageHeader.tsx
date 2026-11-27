import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Page title shown on the left side. */
  title: string;
  /** Optional subtitle shown below the title. */
  description?: string;
  /** Optional icon rendered to the left of the title. */
  icon?: ReactNode;
  /** Optional content rendered on the right side (actions, buttons, etc.). */
  actions?: ReactNode;
}

/**
 * Sticky frosted-glass page header matching the board detail header style.
 *
 * Uses `.board-bg > header` → `board-page-header` CSS so the header blends
 * with whatever BoardBgWrapper gradient is active.
 */
export function PageHeader({ title, description, icon, actions }: PageHeaderProps) {
  return (
    <header className="board-page-header flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4">
      <div className="flex min-w-0 items-center gap-2">
        {icon && (
          <span className="shrink-0 text-[var(--text-muted)]" aria-hidden="true">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {title}
          </h1>
          {description && (
            <p className="truncate text-xs text-[var(--text-muted)]">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
