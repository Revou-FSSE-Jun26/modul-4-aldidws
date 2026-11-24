"use client";

import { useId } from "react";
import { MAX_SEARCH_LENGTH, useCardSearch } from "@/hooks/useCardSearch";
import type { CardListItem } from "@/lib/types/api";
import { BaseButton } from "@/components/shared/BaseButton";

export interface SearchBarProps {
  /** Limits the search to one board. */
  boardId?: string;
  /** Called with the result the user picked. */
  onSelect: (card: CardListItem) => void;
}

/** Search box with a debounced result list. */
export function SearchBar({ boardId, onSelect }: SearchBarProps) {
  const inputId = useId();
  const { query, setQuery, results, isLoading, error, hasSearched } =
    useCardSearch(boardId);

  return (
    <div className="flex w-full max-w-md flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        Search cards
      </label>
      <input
        id={inputId}
        type="search"
        value={query}
        maxLength={MAX_SEARCH_LENGTH}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by title or description"
        className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />

      <div aria-live="polite" className="text-xs text-muted-foreground">
        {isLoading && "Searching…"}
        {hasSearched && !error && results.length === 0 && "No cards match."}
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <ul className="flex list-none flex-col gap-1 p-0" aria-label="Search results">
          {results.map((card) => (
            <li key={card.id}>
              <BaseButton
                variant="secondary"
                size="sm"
                className="w-full !justify-between text-left"
                onClick={() => {
                  onSelect(card);
                  setQuery("");
                }}
              >
                <span className="truncate">{card.title}</span>
                <span className="ml-2 shrink-0 text-muted-foreground">
                  {card.column_name}
                </span>
              </BaseButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
