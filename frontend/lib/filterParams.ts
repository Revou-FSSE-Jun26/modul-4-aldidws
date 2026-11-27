import type { CardFilters, DueFilter, PriorityFilter } from "@/lib/filterCards";

export const MAX_KEYWORD_LENGTH = 100;
export const MAX_FILTER_LABELS = 20;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DUE_VALUES: DueFilter[] = ["overdue", "today", "24h", "7d", "none"];
const PRIORITY_VALUES = ["low", "medium", "high"] as const;

interface ParamsReader {
  get(name: string): string | null;
}

/**
 * Reads the filter keys (`q`, `labels`, `due`) from a query string.
 * Invalid values are dropped without error. Labels are kept only when they look
 * like UUIDs and appear in `validLabelIds`.
 */
export function parseFilterParams(
  searchParams: ParamsReader,
  validLabelIds: string[],
): CardFilters {
  const keyword = (searchParams.get("q") ?? "").trim().slice(0, MAX_KEYWORD_LENGTH);

  const labelIds: string[] = [];
  for (const raw of (searchParams.get("labels") ?? "").split(",")) {
    const id = raw.trim();
    if (
      UUID_PATTERN.test(id) &&
      validLabelIds.includes(id) &&
      !labelIds.includes(id) &&
      labelIds.length < MAX_FILTER_LABELS
    ) {
      labelIds.push(id);
    }
  }

  const dueParam = searchParams.get("due");
  const due = DUE_VALUES.find((value) => value === dueParam) ?? "any";

  const priorityParam = searchParams.get("priority");
  const priority: PriorityFilter =
    PRIORITY_VALUES.find((v) => v === priorityParam) ?? "any";

  return { keyword, labelIds, due, priority };
}

/**
 * Builds a query string from the filters. Empty filters write no keys, and keys
 * that are not filter keys are kept from `existing`.
 */
export function toSearchParams(
  filters: CardFilters,
  existing: { toString(): string },
): URLSearchParams {
  const params = new URLSearchParams(existing.toString());
  params.delete("q");
  params.delete("labels");
  params.delete("due");
  params.delete("priority");

  const keyword = filters.keyword.trim().slice(0, MAX_KEYWORD_LENGTH);
  if (keyword !== "") params.set("q", keyword);
  if (filters.labelIds.length > 0) params.set("labels", filters.labelIds.join(","));
  if (filters.due !== "any") params.set("due", filters.due);
  if (filters.priority !== "any") params.set("priority", filters.priority);
  return params;
}
