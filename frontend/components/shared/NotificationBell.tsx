"use client";

import { useId, useState } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { BaseBadge } from "@/components/shared/BaseBadge";

const MAX_SHOWN = 20;

/**
 * Notification bell with an unread-count badge and a dropdown panel listing
 * the latest notifications. Clicking an item marks it as read.
 *
 * All fetch and timer logic lives in `useNotifications()`.
 */
export function NotificationBell() {
  const { notifications, unreadCount, isFetching, error, markRead } =
    useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();

  const label =
    unreadCount === 0
      ? "Notifications — none unread"
      : `Notifications — ${unreadCount} unread`;

  const shown = notifications.slice(0, MAX_SHOWN);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--bg-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)] focus-visible:ring-offset-2"
      >
        <Bell
          size={16}
          strokeWidth={1.5}
          className={isFetching ? "opacity-50" : ""}
          aria-hidden="true"
        />
        {unreadCount > 0 && (
          <BaseBadge
            variant="danger"
            aria-hidden="true"
            className="absolute -right-1 -top-1"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </BaseBadge>
        )}
      </button>

      {/* Announces count changes to screen readers */}
      <span className="sr-only" aria-live="polite">
        {unreadCount === 0
          ? "No unread notifications"
          : `${unreadCount} unread notifications`}
      </span>

      {isOpen && (
        <div
          id={panelId}
          role="region"
          aria-label="Notifications"
          className="absolute right-0 z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-panel)] p-2 shadow-[var(--shadow-drag)]"
        >
          {error && (
            <p role="alert" className="px-2 py-1 text-sm text-[var(--accent-red)]">
              {error}
            </p>
          )}
          {shown.length === 0 && !error ? (
            <p className="px-2 py-1 text-sm text-[var(--text-muted)]">
              No notifications yet.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-[var(--border)] overflow-y-auto">
              {shown.map((n) => (
                <li key={n.id}>
                  {/* Plain <button> kept on purpose: the whole notification row is
                      the click target (mark as read), not a visual button. */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.is_read) void markRead(n.id);
                    }}
                    className="flex w-full min-h-11 flex-col items-start gap-0.5 rounded px-2 py-2 text-left hover:bg-[var(--bg-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)]"
                  >
                    <span
                      className={[
                        "text-sm text-[var(--text-primary)]",
                        n.is_read ? "font-normal" : "font-semibold",
                      ].join(" ")}
                    >
                      {n.title}
                      {!n.is_read && <span className="sr-only"> (unread)</span>}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">{n.body}</span>
                    <time
                      dateTime={n.created_at}
                      className="text-xs text-[var(--text-muted)]"
                    >
                      {new Date(n.created_at).toLocaleString()}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
