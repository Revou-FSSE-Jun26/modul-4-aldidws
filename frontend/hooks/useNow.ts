"use client";

import { useEffect, useState } from "react";

/**
 * Returns the current time and refreshes it on an interval (default 60 s).
 * Call it once per page and pass the value down, so there is one timer and
 * not one per card.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
