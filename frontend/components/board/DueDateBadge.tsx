import { BaseBadge } from "@/components/shared/BaseBadge";
import { formatDue, getDueState, type DueState } from "@/lib/dueDate";

interface DueDateBadgeProps {
  dueDate: string | null;
  now: Date;
}

const VARIANT: Record<Exclude<DueState, "none">, "danger" | "warning" | "default"> = {
  overdue: "danger",
  soon: "warning",
  upcoming: "default",
};

function ClockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="mr-1 h-3 w-3 shrink-0"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.5V8l2.25 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Due date badge: icon and text, so state is never shown by colour alone. */
export function DueDateBadge({ dueDate, now }: DueDateBadgeProps) {
  const state = getDueState(dueDate, now);
  if (state === "none") return null;
  const label =
    state === "overdue" ? "Overdue" : state === "soon" ? "Due soon" : `Due ${formatDue(dueDate)}`;
  return (
    <BaseBadge variant={VARIANT[state]} title={formatDue(dueDate)}>
      <ClockIcon />
      {label}
    </BaseBadge>
  );
}
