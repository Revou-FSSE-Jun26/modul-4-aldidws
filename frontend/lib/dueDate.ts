/**
 * Pure helpers for card due dates. The server stores and returns UTC ISO
 * strings such as "2026-12-01T17:00:00Z". Display and input use the browser's
 * local time zone (profile time zone is not used in this version).
 */

export type DueState = "none" | "overdue" | "soon" | "upcoming";

export const DUE_MIN_YEAR = 2000;
export const DUE_MAX_YEAR = 2100;
/** Values for the `min` and `max` attributes of a datetime-local input. */
export const DUE_INPUT_MIN = "2000-01-01T00:00";
export const DUE_INPUT_MAX = "2100-12-31T23:59";

const SOON_WINDOW_MS = 24 * 60 * 60 * 1000;

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Overdue when the due date is before `now`. Due soon when it is at most 24
 * hours ahead (a date exactly at `now` counts as soon). Otherwise upcoming.
 */
export function getDueState(dueIso: string | null | undefined, now: Date): DueState {
  const due = parse(dueIso);
  if (!due) return "none";
  const diff = due.getTime() - now.getTime();
  if (diff < 0) return "overdue";
  if (diff <= SOON_WINDOW_MS) return "soon";
  return "upcoming";
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/** "YYYY-MM-DDTHH:mm" in browser local time, or "" for null or invalid input. */
export function isoToLocalInput(iso: string | null | undefined): string {
  const date = parse(iso);
  if (!date) return "";
  return (
    `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * Converts a datetime-local value (browser local time) to a UTC ISO string
 * without milliseconds. Returns null for an empty or invalid value or a UTC
 * year outside 2000..2100.
 */
export function localInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  if (year < DUE_MIN_YEAR || year > DUE_MAX_YEAR) return null;
  return `${date.toISOString().slice(0, 19)}Z`;
}

/**
 * "Mon D, YYYY" in browser local time (e.g. "Nov 5, 2026").
 * No leading zero on the day. Empty for null or invalid input.
 */
export function formatDue(iso: string | null | undefined, locale?: string): string {
  const date = parse(iso);
  if (!date) return "";
  return date.toLocaleDateString(locale ?? "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
