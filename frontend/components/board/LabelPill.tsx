import { colorClassName } from "@/lib/labelColors";
import type { LabelColor } from "@/lib/types/api";

interface LabelPillProps {
  name: string;
  color: LabelColor;
}

/** Text pill for a label. The name is always visible as text, never only a colour. */
export function LabelPill({ name, color }: LabelPillProps) {
  return (
    <span
      title={name}
      className={`inline-block max-w-[10rem] truncate rounded-full px-2 py-0.5 text-xs font-medium ${colorClassName(color)}`}
    >
      {name}
    </span>
  );
}
