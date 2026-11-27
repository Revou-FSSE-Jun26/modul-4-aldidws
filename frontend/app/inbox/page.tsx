"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Inbox as InboxIcon, CheckCheck, Loader2 } from "lucide-react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { loginPath } from "@/lib/loginPath";
import {
  listNotifications,
  markNotificationRead,
} from "@/lib/services/notificationsService";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { showError } from "@/lib/toast";
import { ApiError } from "@/lib/errors";
import { BoardBgWrapper } from "@/components/board/BoardBgWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import type { ApiNotification } from "@/lib/types/api";

type Filter = "all" | "unread";

function relativeTime(iso: string, now: Date): string {
  const t = new Date(iso).getTime();
  const diff = now.getTime() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function InboxList({
  token,
  filter,
  onFilterChange,
}: {
  token: string;
  filter: Filter;
  onFilterChange: (f: Filter) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("loading");
  const [now, setNow] = useState(() => new Date());

  // Re-render the relative time labels every minute while the page is open.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  function load() {
    setStatus("loading");
    listNotifications(token)
      .then((res) => {
        setItems(res.items);
        setUnread(res.unreadCount);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.isUnauthorized) {
          router.replace(loginPath(pathname));
          return;
        }
        setStatus("error");
        showError(err instanceof ApiError ? err.message : "Could not load notifications.");
      });
  }

  useEffect(load, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRead(n: ApiNotification) {
    if (n.is_read) return;
    // Optimistically mark so the UI updates immediately even if the network lags.
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    setUnread((c) => Math.max(0, c - 1));
    try {
      await markNotificationRead(token, n.id);
    } catch (err) {
      // Roll back on failure.
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...n, is_read: false } : x)));
      setUnread((c) => c + 1);
      showError(err instanceof ApiError ? err.message : "Could not mark as read.");
    }
  }

  async function markAll() {
    const pending = items.filter((n) => !n.is_read);
    if (pending.length === 0) return;
    await Promise.all(pending.map((n) => markNotificationRead(token, n.id)));
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  }

  const visible = filter === "unread" ? items.filter((n) => !n.is_read) : items;

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading notifications">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-panel)]"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-panel)] p-6">
        <p role="alert" className="text-sm text-[var(--text-secondary)]">
          Could not load your notifications.
        </p>
        <BaseButton variant="secondary" className="mt-3" onClick={load}>
          Retry
        </BaseButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1" role="tablist" aria-label="Filter notifications">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => onFilterChange(f)}
              className={[
                "rounded-[var(--radius-ctrl)] px-3 py-1.5 text-xs font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)]",
                filter === f
                  ? "bg-[var(--brand)] text-white"
                  : "bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
              ].join(" ")}
            >
              {f === "all" ? "All" : "Unread"}
            </button>
          ))}
        </div>

        {filter === "all" && unread > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <BaseBadge variant="warning">{unread} unread</BaseBadge>
            <BaseButton variant="secondary" size="sm" onClick={markAll} disabled={unread === 0}>
              <CheckCheck size={14} aria-hidden="true" /> Mark all read
            </BaseButton>
          </div>
        )}
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-panel)] px-6 py-12 text-center">
          <InboxIcon size={32} strokeWidth={1.25} aria-hidden="true" className="text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-secondary)]">
            {filter === "unread" ? "No unread notifications." : "No notifications yet."}
          </p>
          <p className="max-w-sm text-xs text-[var(--text-muted)]">
            Activity from your boards — new cards, comments, and mentions — will appear here.
          </p>
        </div>
      ) : (
        <ul role="list" className="flex flex-col gap-2" aria-label={`${visible.length} notifications`}>
          {visible.map((n) => (
            <li key={n.id}>
              <div
                className={[
                  "group flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-panel)] p-4 transition-colors duration-150",
                  n.is_read ? "opacity-80" : "border-l-2 border-l-[var(--brand)]",
                ].join(" ")}
              >
                <span
                  aria-hidden="true"
                  className={[
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    n.is_read
                      ? "bg-[var(--bg-hover)] text-[var(--text-muted)]"
                      : "bg-[var(--brand-soft)] text-[var(--brand)]",
                  ].join(" ")}
                >
                  <Bell size={14} strokeWidth={1.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p
                      className={[
                        "truncate text-sm",
                        n.is_read ? "text-[var(--text-secondary)]" : "font-semibold text-[var(--text-primary)]",
                      ].join(" ")}
                    >
                      {n.title}
                    </p>
                    <time
                      dateTime={n.created_at}
                      className="shrink-0 text-xs text-[var(--text-muted)]"
                    >
                      {relativeTime(n.created_at, now)}
                    </time>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{n.body}</p>

                  {!n.is_read && (
                    <button
                      type="button"
                      onClick={() => void handleRead(n)}
                      className="mt-2 inline-flex items-center gap-1 rounded-[var(--radius-ctrl)] px-2 py-1 text-xs font-medium text-[var(--brand)] transition-colors duration-150 hover:bg-[var(--brand-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)]"
                    >
                      <CheckCheck size={12} aria-hidden="true" /> Mark as read
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Inbox — lists the user's notifications (GET /api/notifications) with an
 * unread filter, per-item "mark as read", and "mark all read".
 *
 * Server Component shell + client component for the authenticated fetch.
 */
export default function InboxPage() {
  const { token, isAuthLoading } = useRequireAuth();
  const [filter, setFilter] = useState<Filter>("all");

  return (
    <BoardBgWrapper className="flex flex-1 flex-col">
      <PageHeader
        title="Inbox"
        description="Notifications from your boards."
        icon={<InboxIcon size={16} strokeWidth={1.5} />}
      />
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {isAuthLoading || !token ? (
            <div
              className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-panel)] p-10"
              aria-busy="true"
              aria-label="Loading inbox"
            >
              <Loader2 size={20} strokeWidth={1.5} aria-hidden="true" className="animate-spin text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-muted)]">Loading…</p>
            </div>
          ) : (
            <InboxList token={token} filter={filter} onFilterChange={setFilter} />
          )}
        </div>
      </main>
    </BoardBgWrapper>
  );
}
