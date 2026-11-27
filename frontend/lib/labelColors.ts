import type { LabelColor } from "@/lib/types/api";

/**
 * The 8 label colours. Class names are written out in full so Tailwind can
 * see them; the colour values live in app/globals.css (--label-<key>-bg/fg).
 */
export const LABEL_COLORS: Record<LabelColor, { name: string; className: string }> = {
  blue: { name: "Blue", className: "bg-[var(--label-blue-bg)] text-[var(--label-blue-fg)]" },
  sky: { name: "Sky", className: "bg-[var(--label-sky-bg)] text-[var(--label-sky-fg)]" },
  graphite: {
    name: "Graphite",
    className: "bg-[var(--label-graphite-bg)] text-[var(--label-graphite-fg)]",
  },
  silver: { name: "Silver", className: "bg-[var(--label-silver-bg)] text-[var(--label-silver-fg)]" },
  red: { name: "Red", className: "bg-[var(--label-red-bg)] text-[var(--label-red-fg)]" },
  orange: { name: "Orange", className: "bg-[var(--label-orange-bg)] text-[var(--label-orange-fg)]" },
  green: { name: "Green", className: "bg-[var(--label-green-bg)] text-[var(--label-green-fg)]" },
  purple: { name: "Purple", className: "bg-[var(--label-purple-bg)] text-[var(--label-purple-fg)]" },
};

export const LABEL_COLOR_KEYS = Object.keys(LABEL_COLORS) as LabelColor[];

export function colorClassName(color: LabelColor): string {
  return LABEL_COLORS[color]?.className ?? LABEL_COLORS.graphite.className;
}
