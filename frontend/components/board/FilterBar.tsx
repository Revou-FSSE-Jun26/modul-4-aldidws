"use client";

import { type ReactNode, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Search, SlidersHorizontal, ArrowUpDown, Layers, ChevronDown, Columns, List } from "lucide-react";
import type { CardFilters, DueFilter, PriorityFilter } from "@/lib/filterCards";
import type { SortBy } from "@/lib/sortCards";
import type { GroupBy } from "@/lib/groupCards";
import type { Label } from "@/lib/types/api";
import { LabelPill } from "@/components/board/LabelPill";

type BoardView = "kanban" | "list";

export interface FilterBarProps {
  labels: Label[];
  filters: CardFilters;
  /** Number of active filters (keyword, labels, due, priority). */
  activeCount: number;
  /** Cards shown and total, computed from the debounced keyword. Null hides the status text. */
  status: { shown: number; total: number } | null;
  /** Whether the filter detail panel is expanded below the `md` breakpoint. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Increment to move focus to the keyword input (the `f` shortcut). */
  focusSignal: number;
  onKeywordChange: (keyword: string) => void;
  onLabelIdsChange: (labelIds: string[]) => void;
  onDueChange: (due: DueFilter) => void;
  onPriorityChange: (priority: PriorityFilter) => void;
  /** Current sort mode. */
  sort: SortBy;
  onSortChange: (sort: SortBy) => void;
  /** Current group-by mode. */
  groupBy: GroupBy;
  onGroupByChange: (groupBy: GroupBy) => void;
  onClear: () => void;
  /**
   * Current board view (kanban / list). Passed in from BoardDetailView so the
   * segmented tab control can live in the toolbar row.
   */
  view?: BoardView;
  onViewChange?: (view: BoardView) => void;
  /**
   * Optional action elements (Import/Export split button, Add New split button,
   * etc.) rendered in the right side of the toolbar row.
   */
  actions?: ReactNode;
}

const DUE_OPTIONS: { value: DueFilter; text: string }[] = [
  { value: "any", text: "Any due date" },
  { value: "overdue", text: "Overdue cards" },
  { value: "today", text: "Due today" },
  { value: "24h", text: "Due in the next 24 hours" },
  { value: "7d", text: "Due in the next 7 days" },
  { value: "none", text: "No due date" },
];

const PRIORITY_OPTIONS: { value: PriorityFilter; text: string }[] = [
  { value: "any", text: "Any priority" },
  { value: "low", text: "Low" },
  { value: "medium", text: "Medium" },
  { value: "high", text: "High" },
];

const SORT_OPTIONS: { value: SortBy; text: string }[] = [
  { value: "manual", text: "Manual" },
  { value: "due", text: "Due date" },
  { value: "priority", text: "Priority" },
  { value: "created", text: "Created (newest first)" },
  { value: "title", text: "Title (A-Z)" },
];

const GROUP_OPTIONS: { value: GroupBy; text: string }[] = [
  { value: "none", text: "None" },
  { value: "priority", text: "Priority" },
];

/** Shared classes for select/input controls inside the filter detail panel. */
const controlClasses =
  "rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-input)] px-3 py-1.5 text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-light)]";

/**
 * Toolbar + filter panel for the board.
 *
 * Row 1 (always visible): view tab control (Kanban / List), Filter / Sort /
 *   Group bordered buttons, search input, and the right-side `actions` slot.
 *
 * Row 2 (expanded): filter detail panel (labels, due, priority, sort, group,
 *   clear). On wide screens it shows inline; on narrow screens it toggles via
 *   the Filter button.
 */
export function FilterBar({
  labels,
  filters,
  activeCount,
  status,
  open,
  onOpenChange,
  focusSignal,
  onKeywordChange,
  onLabelIdsChange,
  onDueChange,
  onPriorityChange,
  sort,
  onSortChange,
  groupBy,
  onGroupByChange,
  onClear,
  view,
  onViewChange,
  actions,
}: FilterBarProps) {
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const keywordId = `${baseId}-keyword`;
  const dueId = `${baseId}-due`;
  const priorityId = `${baseId}-priority`;
  const sortId = `${baseId}-sort`;
  const groupId = `${baseId}-group`;
  const listId = `${baseId}-labels`;
  const labelsButtonId = `${baseId}-labels-button`;
  const keywordRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (focusSignal > 0) keywordRef.current?.focus();
  }, [focusSignal]);

  useEffect(() => {
    if (labelsOpen) listRef.current?.focus();
  }, [labelsOpen]);

  function toggleLabel(id: string) {
    onLabelIdsChange(
      filters.labelIds.includes(id)
        ? filters.labelIds.filter((x) => x !== id)
        : [...filters.labelIds, id],
    );
  }

  function closeLabels() {
    setLabelsOpen(false);
    document.getElementById(labelsButtonId)?.focus();
  }

  function handleListKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeLabels();
    } else if (labels.length === 0) {
      return;
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, labels.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(labels.length - 1);
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggleLabel(labels[activeIndex].id);
    }
  }

  const selectedCount = filters.labelIds.length;

  // ---- Toolbar icon button shared classes --------------------------------
  const toolbarBtnCls =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-panel)] px-3 text-[13px] font-medium text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--bg-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)] focus-visible:ring-offset-2";

  return (
    <section
      aria-label="Filter cards"
      className="flex flex-col border-b border-[var(--border)] bg-[var(--bg-panel)]"
    >
      {/* ── Toolbar row ──────────────────────────────────────────────────── */}
      <div className="flex h-12 items-center gap-2 px-4">

        {/* View tab segmented control (§4.3.1) */}
        {view !== undefined && onViewChange && (
          <div
            role="group"
            aria-label="View switcher"
            className="flex items-stretch rounded-[var(--radius-ctrl)] bg-[var(--bg-input)] p-0.5"
          >
            <button
              type="button"
              aria-pressed={view === "kanban"}
              onClick={() => onViewChange("kanban")}
              className={[
                "inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-[13px] font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)] focus-visible:ring-offset-1",
                view === "kanban"
                  ? "border border-[var(--border)] bg-[var(--bg-panel)] shadow-[var(--shadow-card)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
              ].join(" ")}
            >
              <Columns size={14} strokeWidth={1.5} aria-hidden="true" />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              aria-pressed={view === "list"}
              onClick={() => onViewChange("list")}
              className={[
                "inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-[13px] font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)] focus-visible:ring-offset-1",
                view === "list"
                  ? "border border-[var(--border)] bg-[var(--bg-panel)] shadow-[var(--shadow-card)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
              ].join(" ")}
            >
              <List size={14} strokeWidth={1.5} aria-hidden="true" />
              <span>List</span>
            </button>
          </div>
        )}

        {/* Search input (§4.3) */}
        <div className="relative hidden w-[220px] md:flex">
          <Search
            size={14}
            strokeWidth={1.5}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <input
            id={keywordId}
            ref={keywordRef}
            type="search"
            value={filters.keyword}
            maxLength={100}
            aria-keyshortcuts="f"
            aria-label="Filter cards"
            placeholder="Search tasks"
            onChange={(e) => onKeywordChange(e.target.value)}
            className="h-9 w-full rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-input)] pl-8 pr-3 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-light)]"
          />
        </div>

        {/* Filter button — toggles the detail panel */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onOpenChange(!open)}
          className={[
            toolbarBtnCls,
            open ? "bg-[var(--bg-hover)]" : "",
          ].join(" ")}
        >
          <SlidersHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
          <span className="hidden sm:inline">
            {activeCount > 0 ? `Filters (${activeCount} active)` : "Filters"}
          </span>
        </button>

        {/* Sort button (§4.3.1) — opens the detail panel to the sort select */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onOpenChange(!open)}
          className={toolbarBtnCls}
        >
          <ArrowUpDown size={16} strokeWidth={1.5} aria-hidden="true" />
          <span className="hidden sm:inline">Sort</span>
        </button>

        {/* Group button (§4.3.1) */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onOpenChange(!open)}
          className={toolbarBtnCls}
        >
          <Layers size={16} strokeWidth={1.5} aria-hidden="true" />
          <span className="hidden sm:inline">Group</span>
          <ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" className="hidden sm:inline" />
        </button>

        {/* Right-side actions slot */}
        <div className="ml-auto flex items-center gap-2">
          {actions}
        </div>
      </div>

      {/* ── Filter detail panel ─────────────────────────────────────────── */}
      <div
        id={panelId}
        className={`${open ? "flex" : "hidden"} flex-col gap-3 border-t border-[var(--border)] px-4 py-3 md:flex-row md:flex-wrap md:items-end`}
      >
        {/* Mobile search (visible only below md where the toolbar input is hidden) */}
        <div className="flex flex-col gap-1 md:hidden">
          <label htmlFor={`${keywordId}-m`} className="text-[13px] font-medium text-[var(--text-primary)]">
            Search tasks
          </label>
          <input
            id={`${keywordId}-m`}
            type="search"
            value={filters.keyword}
            maxLength={100}
            aria-keyshortcuts="f"
            placeholder="Title or description (press f)"
            onChange={(e) => onKeywordChange(e.target.value)}
            className={`${controlClasses} w-full`}
          />
        </div>

        <div className="relative flex flex-col gap-1">
          <span className="text-[13px] font-medium text-[var(--text-primary)]">Labels</span>
          <button
            id={labelsButtonId}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={labelsOpen}
            aria-controls={labelsOpen ? listId : undefined}
            onClick={() => {
              if (labelsOpen) closeLabels();
              else {
                setActiveIndex(0);
                setLabelsOpen(true);
              }
            }}
            className={[
              toolbarBtnCls,
              "h-8",
            ].join(" ")}
          >
            {selectedCount > 0 ? `Labels (${selectedCount} selected)` : "Any label"}
          </button>
          {labelsOpen && (
            <div className="flex flex-col gap-1 rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-panel)] p-2 shadow-[var(--shadow-drag)]">
              {labels.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">This board has no labels yet.</p>
              ) : (
                <div
                  id={listId}
                  ref={listRef}
                  role="listbox"
                  aria-label="Cards with any of these labels"
                  aria-multiselectable="true"
                  aria-activedescendant={`${listId}-${activeIndex}`}
                  tabIndex={0}
                  onKeyDown={handleListKeyDown}
                  className="flex flex-col gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)]"
                >
                  {labels.map((label, i) => {
                    const selected = filters.labelIds.includes(label.id);
                    return (
                      <div
                        key={label.id}
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          setActiveIndex(i);
                          toggleLabel(label.id);
                        }}
                        className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm transition-colors ${
                          i === activeIndex ? "bg-[var(--bg-hover)]" : ""
                        }`}
                      >
                        <span aria-hidden="true" className="w-4 text-[var(--text-primary)]">
                          {selected ? "✓" : ""}
                        </span>
                        <LabelPill name={label.name} color={label.color} />
                      </div>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                onClick={closeLabels}
                className={`${toolbarBtnCls} h-8 text-xs`}
              >
                Close
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={dueId} className="text-[13px] font-medium text-[var(--text-primary)]">
            Due date
          </label>
          <select
            id={dueId}
            value={filters.due}
            onChange={(e) => onDueChange(e.target.value as DueFilter)}
            className={controlClasses}
          >
            {DUE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.text}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={priorityId} className="text-[13px] font-medium text-[var(--text-primary)]">
            Priority
          </label>
          <select
            id={priorityId}
            value={filters.priority}
            onChange={(e) => onPriorityChange(e.target.value as PriorityFilter)}
            className={controlClasses}
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.text}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={sortId} className="text-[13px] font-medium text-[var(--text-primary)]">
            Sort by
          </label>
          <select
            id={sortId}
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortBy)}
            className={controlClasses}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.text}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={groupId} className="text-[13px] font-medium text-[var(--text-primary)]">
            Group by
          </label>
          <select
            id={groupId}
            value={groupBy}
            onChange={(e) => onGroupByChange(e.target.value as GroupBy)}
            className={controlClasses}
          >
            {GROUP_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.text}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          disabled={activeCount === 0}
          onClick={onClear}
          className={[
            toolbarBtnCls,
            "h-8",
            activeCount === 0 ? "cursor-not-allowed opacity-50" : "",
          ].join(" ")}
        >
          Clear all
        </button>
      </div>

      {(activeCount > 0 || sort !== "manual") && (
        <p className="px-4 pb-2 text-xs text-[var(--text-muted)]">
          Dragging is turned off while filters or sorting are active. Clear the filters to move
          cards by dragging, or use Move to column in the card dialog.
        </p>
      )}

      <p aria-live="polite" className="px-4 pb-1 text-xs text-[var(--text-muted)]">
        {status ? `${status.shown} of ${status.total} cards shown` : ""}
      </p>
    </section>
  );
}
