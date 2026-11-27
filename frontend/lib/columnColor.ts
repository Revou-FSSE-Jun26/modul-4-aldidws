import type { ColumnColor } from "@/lib/types/api";

export const COLUMN_COLORS: readonly ColumnColor[] = ["gray", "blue", "orange", "green", "red"];

/** Returns the stored color, or cycles through COLUMN_COLORS by the column's index in the board. */
export function resolveColumnColor(color: ColumnColor | null | undefined, index: number): ColumnColor {
  if (color) return color;
  const n = COLUMN_COLORS.length;
  return COLUMN_COLORS[((index % n) + n) % n];
}
