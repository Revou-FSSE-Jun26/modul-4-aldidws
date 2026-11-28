"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { BaseBadge } from "@/components/shared/BaseBadge";

const MAX_SHOWN = 20;

/**
 * Notification bell with an unread-count badge and a dropdown panel listing
 * the latest notifications. Clicking an item marks it as read and opens it
 * in the Inbox.
 *
 * All fetch and timer logic lives in `useNotifications()`.
 */
export function NotificationBell() {
  const router = useRouter();
  const { notifications, unreadCount, isFetching, error, markRead } =
    useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isOpen]);

  const label =
    unreadCount === 0
      ? "Notifications — none unread"
      : `Notifications — ${unreadCount} unread`;

  const shown = notifications.slice(0, MAX_SHOWN);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
        className="relative flex h-8 w-8 items-center justify-center rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--bg-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)] focus-visible:ring-offset-2"
      >
        <Bell
          size={15}
          strokeWidth={1.5}
          className={isFetching ? "opacity-50" : ""}
          aria-hidden="true"
        />
        {unreadCount > 0 && (
          <BaseBadge
            variant="danger"
            aria-hidden="true"
            className="absolute -right-1.5 -top-1.5"
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
          className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-panel)] p-2 shadow-[var(--shadow-drag)]"
        >
          <div className="mb-1 flex items-center justify-between border-b border-[var(--border)] px-2 pb-1.5">
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              Notifications
            </span>
            <Link
              href="/inbox"
              onClick={() => setIsOpen(false)}
              className="text-xs font-medium text-[var(--brand)] hover:underline"
            >
              View all
            </Link>
          </div>

          {error && (
            <p role="alert" className="px-2 py-1 text-sm text-[var(--accent-red)]">
              {error}
            </p>
          )}
          {shown.length === 0 && !error ? (
            <p className="px-2 py-3 text-center text-xs text-[var(--text-muted)]">
              No notifications yet.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-[var(--border)] overflow-y-auto">
              {shown.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.is_read) void markRead(n.id);
                      setIsOpen(false);
                      router.push(`/inbox?item=${encodeURIComponent(n.id)}`);
                    }}
                    className="flex min-h-11 w-full flex-col items-start gap-0.5 rounded px-2 py-2 text-left hover:bg-[var(--bg-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)]"
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
                    <span className="line-clamp-2 text-xs text-[var(--text-muted)]">
                      {n.body}
                    </span>
                    <time
                      dateTime={n.created_at}
                      className="text-[11px] text-[var(--text-muted)]"
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