import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface CardSearchResult {
  id: string;
  title: string;
  description: string | null;
  column_id: string;
  position: number;
  /** Board name, returned when the endpoint supports it. */
  board_name?: string | null;
  board_id?: string | null;
  created_at: string;
  updated_at: string;
}

/** All filter parameters the hook accepts. Every field is optional. */
export interface CardSearchFilters {
  /** Free-text search query (title + description). */
  query?: string;
  /** Filter by assignee display name or id — passed as `assignee=` param. */
  assignee?: string;
  /** ISO 8601 date string — lower bound of due-date range (inclusive). */
  dueDateFrom?: string;
  /** ISO 8601 date string — upper bound of due-date range (inclusive). */
  dueDateTo?: string;
  /** Label / tag filter. */
  label?: string;
}

export interface UseCardSearchReturn {
  results: CardSearchResult[];
  isLoading: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const DEBOUNCE_MS = 300;

function buildQueryString(filters: CardSearchFilters): string {
  const params = new URLSearchParams();

  if (filters.query?.trim()) params.set("search", filters.query.trim());
  if (filters.assignee?.trim()) params.set("assignee", filters.assignee.trim());
  if (filters.dueDateFrom?.trim()) params.set("due_date_from", filters.dueDateFrom.trim());
  if (filters.dueDateTo?.trim()) params.set("due_date_to", filters.dueDateTo.trim());
  if (filters.label?.trim()) params.set("label", filters.label.trim());

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function fetchCards(
  token: string,
  filters: CardSearchFilters,
): Promise<CardSearchResult[]> {
  // GET /api/cards is not yet implemented on the backend.
  // When it ships it should return { data: CardSearchResult[] }.
  // 404/405 are treated as an empty result so the component renders
  // gracefully today and populates automatically once the endpoint exists.
  const qs = buildQueryString(filters);
  const res = await fetch(`${API_BASE}/api/cards${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 404 || res.status === 405) return [];
  if (!res.ok) {
    throw new Error(`Search failed (${res.status})`);
  }

  const json = (await res.json()) as { data: CardSearchResult[] };
  return json.data;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Debounced card search hook.
 *
 * Every time `filters` changes the hook schedules a 300 ms debounce timer
 * before firing `GET /api/cards?search=...` with the active query params.
 * On each change — including component unmount — `clearTimeout` is called
 * in the `useEffect` cleanup to cancel the pending timer and prevent stale
 * fetches from updating state.
 *
 * Returns `results`, `isLoading`, and `error`.
 * No fetch or timer logic belongs in the consuming component.
 *
 * Usage:
 * ```ts
 * const { results, isLoading } = useCardSearch({ query, assignee });
 * ```
 */
export function useCardSearch(filters: CardSearchFilters): UseCardSearchReturn {
  const { token, isLoading: isAuthLoading } = useAuth();

  const [results, setResults] = useState<CardSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable ref to the latest filters to avoid capturing stale values in the
  // async fetch callback.
  const filtersRef = useRef<CardSearchFilters>(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters.query, filters.assignee, filters.dueDateFrom, filters.dueDateTo, filters.label]);

  useEffect(() => {
    // Don't search while auth is still rehydrating.
    if (isAuthLoading) return;
    // Don't issue authenticated requests without a token.
    if (!token) return;

    let cancelled = false;

    // Schedule the debounced fetch.
    const timerId = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchCards(token, filtersRef.current);
        if (!cancelled) {
          setResults(data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Search failed.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    // Cleanup: clear the timer on every re-run (keystroke) and on unmount.
    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [
    token,
    isAuthLoading,
    // Spread individual filter fields as effect dependencies so React can
    // compare primitives rather than a new object reference on every render.
    filters.query,
    filters.assignee,
    filters.dueDateFrom,
    filters.dueDateTo,
    filters.label,
  ]);

  return { results, isLoading, error };
}
