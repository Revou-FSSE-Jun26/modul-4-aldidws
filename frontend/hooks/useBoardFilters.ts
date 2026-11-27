"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { countActiveFilters, type CardFilters, type DueFilter, type PriorityFilter } from "@/lib/filterCards";
import { parseFilterParams, toSearchParams } from "@/lib/filterParams";

const URL_DEBOUNCE_MS = 300;

/**
 * Board filter state backed by the URL query (`q`, `labels`, `due`).
 *
 * The keyword is local state so cards react while typing. The URL is written
 * 300 ms after the last keystroke; label and due changes write at once. The URL
 * is only written in response to a user action, never because a value in it is
 * invalid or because the board has not loaded yet.
 *
 * @param validLabelIds labels of the loaded board (empty until it loads).
 */
export function useBoardFilters(validLabelIds: string[]) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const parsed = useMemo(
    () => parseFilterParams(searchParams, validLabelIds),
    [searchParams, validLabelIds],
  );

  const [keyword, setKeywordState] = useState(
    () => parseFilterParams(searchParams, []).keyword,
  );
  const [debouncedKeyword, setDebouncedKeyword] = useState(keyword);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest values for the timer callback.
  const latest = useRef({ searchParams, pathname, parsed });
  useEffect(() => {
    latest.current = { searchParams, pathname, parsed };
  });

  const write = useCallback(
    (next: CardFilters) => {
      const { searchParams: current, pathname: path } = latest.current;
      const query = toSearchParams(next, current).toString();
      router.replace(query ? `${path}?${query}` : path, { scroll: false });
    },
    [router],
  );

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const filters: CardFilters = useMemo(
    () => ({ keyword, labelIds: parsed.labelIds, due: parsed.due, priority: parsed.priority }),
    [keyword, parsed.labelIds, parsed.due, parsed.priority],
  );

  const setKeyword = useCallback(
    (value: string) => {
      setKeywordState(value);
      clearTimer();
      timer.current = setTimeout(() => {
        timer.current = null;
        setDebouncedKeyword(value);
        write({ ...latest.current.parsed, keyword: value });
      }, URL_DEBOUNCE_MS);
    },
    [write, clearTimer],
  );

  const setLabelIds = useCallback(
    (labelIds: string[]) => {
      clearTimer();
      setDebouncedKeyword(keyword);
      write({ ...latest.current.parsed, keyword, labelIds });
    },
    [keyword, write, clearTimer],
  );

  const setDue = useCallback(
    (due: DueFilter) => {
      clearTimer();
      setDebouncedKeyword(keyword);
      write({ ...latest.current.parsed, keyword, due });
    },
    [keyword, write, clearTimer],
  );

  const setPriority = useCallback(
    (priority: PriorityFilter) => {
      clearTimer();
      setDebouncedKeyword(keyword);
      write({ ...latest.current.parsed, keyword, priority });
    },
    [keyword, write, clearTimer],
  );

  const clear = useCallback(() => {
    clearTimer();
    setKeywordState("");
    setDebouncedKeyword("");
    write({ keyword: "", labelIds: [], due: "any", priority: "any" });
  }, [write, clearTimer]);

  return {
    filters,
    /** Keyword value that has been stable for 300 ms; drives the status text. */
    debouncedKeyword,
    activeCount: countActiveFilters(filters),
    setKeyword,
    setLabelIds,
    setDue,
    setPriority,
    clear,
  };
}
