"use client";

import { useNotifications } from "@/hooks/useNotifications";

/**
 * Notification bell icon with an unread-count badge.
 *
 * All fetch and timer logic lives in `useNotifications()`.  This component
 * is purely presentational: it consumes the hook and renders the result.
 *
 * Uses `"use client"` because it consumes a hook that uses `useState` and
 * `useEffect`.
 *
 * Accessibility:
 * - The button carries `aria-label` that includes the unread count so screen
 *   readers announce "3 unread notifications" rather than just "bell".
 * - The badge is hidden from assistive technology (`aria-hidden`) because
 *   the count is already in the button label.
 */
export function NotificationBell() {
  const { unreadCount, isFetching } = useNotifications();

  const label =
    unreadCount === 0
      ? "Notifications — none unread"
      : `Notifications — ${unreadCount} unread`;

  return (
    <button
      type="button"
      aria-label={label}
      className="relative inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Bell icon — inline SVG, no icon library dependency */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className={[
          "h-5 w-5",
          isFetching ? "opacity-50" : "",
        ].join(" ")}
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 2a6 6 0 0 0-6 6v1.586l-.707.707A1 1 0 0 0 4 12h12a1 1 0 0 0 .707-1.707L16 9.586V8a6 6 0 0 0-6-6ZM10 18a3 3 0 0 1-2.83-2h5.66A3 3 0 0 1 10 18Z"
          clipRule="evenodd"
        />
      </svg>

      {/* Unread badge — hidden from screen readers (count is in aria-label) */}
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className={[
            "absolute right-1 top-1",
            "flex h-4 min-w-4 items-center justify-center",
            "rounded-full bg-red-500 px-1",
            "text-[10px] font-semibold leading-none text-white",
          ].join(" ")}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
