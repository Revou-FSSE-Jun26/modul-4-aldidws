"use client";

import { useState } from "react";
import { useCardSearch, type CardSearchFilters, type CardSearchResult } from "@/hooks/useCardSearch";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SearchBarProps {
  /**
   * Called with the current result set after every debounced fetch.
   * The parent component uses this to render results; SearchBar stays
   * focused on filter controls only.
   */
  onResults?: (results: CardSearchResult[]) => void;
}

// ---------------------------------------------------------------------------
// Field component — shared label + input pattern
// ---------------------------------------------------------------------------

interface FieldProps {
  id: string;
  label: string;
  type?: "text" | "date";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function Field({ id, label, type = "text", value, onChange, placeholder }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Card search bar with controlled inputs for query, assignee, due-date range,
 * and label.
 *
 * All filter values are held in local `useState`.  On every change the
 * `useCardSearch` hook receives the updated filters and handles the 300 ms
 * debounce + `GET /api/cards?search=...` fetch internally — this component
 * contains zero fetch or timer logic.
 *
 * Uses `"use client"` because it manages controlled input state and consumes
 * the search hook.
 *
 * Usage:
 * ```tsx
 * <SearchBar onResults={(cards) => setFilteredCards(cards)} />
 * ```
 */
export function SearchBar({ onResults }: SearchBarProps) {
  // Controlled filter state — each field bound to its own useState pair.
  const [query, setQuery] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDateFrom, setDueDateFrom] = useState("");
  const [dueDateTo, setDueDateTo] = useState("");
  const [label, setLabel] = useState("");

  const filters: CardSearchFilters = {
    query,
    assignee,
    dueDateFrom,
    dueDateTo,
    label,
  };

  const { results, isLoading, error } = useCardSearch(filters);

  // Notify parent whenever results change.
  // We call this in the render body rather than a useEffect to avoid an extra
  // render cycle; the parent derives its display state from the callback.
  // Note: if `onResults` is not stable across renders this could cause issues —
  // callers should wrap it in useCallback or pass a stable reference.
  if (onResults) {
    // Only call synchronously when results are ready (not while loading).
    if (!isLoading) {
      onResults(results);
    }
  }

  function handleClear() {
    setQuery("");
    setAssignee("");
    setDueDateFrom("");
    setDueDateTo("");
    setLabel("");
  }

  const hasActiveFilters =
    query || assignee || dueDateFrom || dueDateTo || label;

  return (
    <div className="flex flex-col gap-4">
      {/* Primary search row */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor="card-search-query" className="sr-only">
            Search cards
          </label>
          <div className="relative">
            {/* Search icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                clipRule="evenodd"
              />
            </svg>
            <input
              id="card-search-query"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cards by title or description…"
              aria-label="Search cards"
              className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <span
            role="status"
            aria-label="Searching…"
            className="shrink-0 text-xs text-muted-foreground"
          >
            Searching…
          </span>
        )}

        {/* Clear all */}
        {hasActiveFilters && !isLoading && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 rounded-md px-3 py-2 text-xs text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear
          </button>
        )}
      </div>

      {/* Secondary filter row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          id="card-filter-assignee"
          label="Assignee"
          value={assignee}
          onChange={setAssignee}
          placeholder="e.g. alice"
        />

        <Field
          id="card-filter-due-from"
          label="Due from"
          type="date"
          value={dueDateFrom}
          onChange={setDueDateFrom}
        />

        <Field
          id="card-filter-due-to"
          label="Due to"
          type="date"
          value={dueDateTo}
          onChange={setDueDateTo}
        />

        <Field
          id="card-filter-label"
          label="Label"
          value={label}
          onChange={setLabel}
          placeholder="e.g. bug"
        />
      </div>

      {/* Inline error */}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
