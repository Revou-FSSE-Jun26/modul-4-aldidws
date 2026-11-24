"use client";

import { useId, useState } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";

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
      <BaseButton
        variant="secondary"
        size="icon"
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
        className="relative"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={["h-5 w-5", isFetching ? "opacity-50" : ""].join(" ")}
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 2a6 6 0 0 0-6 6v1.586l-.707.707A1 1 0 0 0 4 12h12a1 1 0 0 0 .707-1.707L16 9.586V8a6 6 0 0 0-6-6ZM10 18a3 3 0 0 1-2.83-2h5.66A3 3 0 0 1 10 18Z"
            clipRule="evenodd"
          />
        </svg>
        {unreadCount > 0 && (
          <BaseBadge
            variant="danger"
            aria-hidden="true"
            className="absolute -right-1 -top-1"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </BaseBadge>
        )}
      </BaseButton>

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
          className="absolute right-0 z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-md border border-border bg-background p-2 shadow-lg"
        >
          {error && (
            <p role="alert" className="px-2 py-1 text-sm text-destructive">
              {error}
            </p>
          )}
          {shown.length === 0 && !error ? (
            <p className="px-2 py-1 text-sm text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {shown.map((n) => (
                <li key={n.id}>
                  {/* Plain <button> kept on purpose: the whole notification row is
                      the click target (mark as read), not a visual button. */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.is_read) void markRead(n.id);
                    }}
                    className="flex w-full min-h-11 flex-col items-start gap-0.5 rounded px-2 py-2 text-left hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className={[
                        "text-sm text-foreground",
                        n.is_read ? "font-normal" : "font-semibold",
                      ].join(" ")}
                    >
                      {n.title}
                      {!n.is_read && <span className="sr-only"> (unread)</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">{n.body}</span>
                    <time
                      dateTime={n.created_at}
                      className="text-xs text-muted-foreground"
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
