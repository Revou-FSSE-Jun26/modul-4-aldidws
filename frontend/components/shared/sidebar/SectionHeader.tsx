import { ChevronLeft } from "lucide-react";

interface SectionHeaderProps {
  label: string;
  open: boolean;
  collapsed: boolean;
  onToggle: () => void;
}

/**
 * Collapsible section header with expand/collapse chevron.
 */
export function SectionHeader({ label, open, collapsed, onToggle }: SectionHeaderProps) {
  return (
    <button
      type="button"
      aria-expanded={!collapsed ? open : undefined}
      aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
      onClick={onToggle}
      className={[
        "flex h-8 w-full items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-[var(--text-secondary)]",
        "transition-colors duration-150 hover:bg-[var(--bg-hover)]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)]",
        collapsed ? "justify-center" : "",
      ].join(" ")}
    >
      <ChevronLeft
        size={14}
        strokeWidth={1.5}
        aria-hidden="true"
        className={[
          "shrink-0 text-[var(--text-muted)] transition-transform duration-200",
          collapsed ? "hidden" : open ? "-rotate-90" : "rotate-0 -rotate-180",
        ].join(" ")}
      />
      <span
        className={[
          "truncate transition-[opacity,max-width] duration-150",
          collapsed ? "max-w-0 overflow-hidden opacity-0" : "max-w-[160px] opacity-100",
        ].join(" ")}
      >
        {label}
      </span>
    </button>
  );
}
