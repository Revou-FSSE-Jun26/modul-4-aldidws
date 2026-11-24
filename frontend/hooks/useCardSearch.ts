"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { listCards } from "@/lib/services/cardsService";
import type { CardListItem } from "@/lib/types/api";

export const MAX_SEARCH_LENGTH = 100;

interface SearchResult {
  term: string;
  items: CardListItem[];
  error: string | null;
}

export interface UseCardSearchReturn {
  query: string;
  setQuery: (value: string) => void;
  /** Matching cards for the current (debounced) query; empty while loading. */
  results: CardListItem[];
  isLoading: boolean;
  error: string | null;
  /** True once a response for the current query has arrived. */
  hasSearched: boolean;
}

/**
 * Debounced card search over GET /api/v1/cards?search=...
 * An empty query sends no request. Responses for an older query are ignored.
 */
export function useCardSearch(boardId?: string): UseCardSearchReturn {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const term = useDebounce(query.trim().slice(0, MAX_SEARCH_LENGTH), 300);

  useEffect(() => {
    if (!term || !token) return;
    let cancelled = false;
    listCards(token, { search: term, board_id: boardId, per_page: 20 })
      .then(({ data }) => {
        if (!cancelled) setResult({ term, items: data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult({
            term,
            items: [],
            error: err instanceof Error ? err.message : "Search failed.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [term, token, boardId]);

  const current = query.trim().slice(0, MAX_SEARCH_LENGTH);
  const hasSearched = term !== "" && term === current && result?.term === term;
  return {
    query,
    setQuery,
    results: hasSearched && result ? result.items : [],
    isLoading: current !== "" && !hasSearched,
    error: hasSearched && result ? result.error : null,
    hasSearched,
  };
}
