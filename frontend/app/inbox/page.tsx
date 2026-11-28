"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  Inbox as InboxIcon,
  CheckCheck,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { loginPath } from "@/lib/loginPath";
import {
  listNotifications,
  markNotificationRead,
} from "@/lib/services/notificationsService";
import { BaseButton } from "@/components/shared/BaseButton";
import { showError } from "@/lib/toast";
import { ApiError } from "@/lib/errors";
import type { ApiNotification } from "@/lib/types/api";

type Filter = "all" | "unread";

const PREVIEW_NOTIFICATIONS: ApiNotification[] = [
  {
    id: "preview-1",
    user_id: "preview-user",
    title: "New card added to In Progress",
    body: "Budi moved \"API integration review\" to In Progress on test board.",
    is_read: false,
    created_at: new Date(Date.now() - 8 * 60_000).toISOString(),
    updated_at: new Date(Date.now() - 8 * 60_000).toISOString(),
  },
  {
    id: "preview-2",
    user_id: "preview-user",
    title: "Mentioned in a comment",
    body: "@budi mentioned you on \"Design notes & layout polish\": ready for a quick look.",
    is_read: false,
    created_at: new Date(Date.now() - 42 * 60_000).toISOString(),
    updated_at: new Date(Date.now() - 42 * 60_000).toISOString(),
  },
  {
    id: "preview-3",
    user_id: "preview-user",
    title: "Card marked complete",
    body: "\"Setup authentication flow\" was moved to Done.",
    is_read: true,
    created_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
  },
];

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
  const [status, setStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("loading");
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const searchParams = useSearchParams();
  const itemParam = searchParams.get("item");
  const handledItemRef = useRef<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (!itemParam) {
      handledItemRef.current = null;
      return;
    }
    if (status !== "ready" || handledItemRef.current === itemParam) return;

    // The "Unread" tab could hide the item, so switch to "All" first.
    if (filter !== "all") {
      onFilterChange("all");
      return;
    }

    handledItemRef.current = itemParam;
    const target = items.find((n) => n.id === itemParam);
    if (target) {
      setHighlightId(target.id);
      requestAnimationFrame(() =>
        document
          .getElementById(`notification-${target.id}`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" }),
      );
      void handleRead(target);
    }
    router.replace(pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemParam, status, filter, items]);

  useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => setHighlightId(null), 2500);
    return () => window.clearTimeout(t);
  }, [highlightId]);

  // Re-render the relative time labels every minute while the page is open.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  function load() {
    setStatus("loading");
    setIsPreviewMode(false);
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
        showError(
          err instanceof ApiError ? err.message : "Could not load notifications.",
        );
      });
  }

  useEffect(load, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePreviewNotifications() {
    setIsPreviewMode(true);
    setItems(PREVIEW_NOTIFICATIONS);
    setUnread(PREVIEW_NOTIFICATIONS.filter((n) => !n.is_read).length);
  }

  async function handleRead(n: ApiNotification) {
    if (n.is_read) return;
    setItems((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)),
    );
    setUnread((c) => Math.max(0, c - 1));

    if (isPreviewMode) return;

    try {
      await markNotificationRead(token, n.id);
    } catch (err) {
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, is_read: false } : x)),
      );
      setUnread((c) => c + 1);
      showError(
        err instanceof ApiError ? err.message : "Could not mark as read.",
      );
    }
  }

  async function markAll() {
    const pending = items.filter((n) => !n.is_read);
    if (pending.length === 0) return;

    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);

    if (isPreviewMode) return;

    try {
      await Promise.all(pending.map((n) => markNotificationRead(token, n.id)));
    } catch (err) {
      load();
      showError(
        err instanceof ApiError ? err.message : "Could not mark all as read.",
      );
    }
  }

  const visible =
    filter === "unread" ? items.filter((n) => !n.is_read) : items;

  if (status === "loading") {
    return (
      <div className="flex w-full flex-1 flex-col gap-5">
        <div className="h-32 animate-pulse rounded-2xl bg-[#DCE5CC]/70" />
        <div className="h-10 animate-pulse rounded-xl border border-[#E6E8E3] bg-white" />
        <div className="h-64 animate-pulse rounded-2xl border border-[#E6E8E3] bg-white" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex w-full flex-1 flex-col gap-5">
        <section className="flex flex-col justify-between gap-4 rounded-2xl bg-[#DCE5CC] px-7 py-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4E6356]">
              YOUR UPDATES, IN ONE PLACE
            </p>
            <h1 className="mt-1 font-serif text-3xl italic tracking-tight text-[#162B22] sm:text-[34px] sm:leading-tight">
              Inbox
            </h1>
            <p className="mt-1.5 text-[13px] text-[#3F5347]">
              Keep track of comments, mentions, and activity from your boards.
            </p>
          </div>
        </section>

        <div className="rounded-2xl border border-[#E6E8E3] bg-white p-6">
          <p role="alert" className="text-sm text-[#3F5347]">
            Could not load your notifications.
          </p>
          <BaseButton
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3 cursor-pointer"
            onClick={load}
          >
            Retry
          </BaseButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-5">
      {/* 1. Hero Banner (Sage Green Card) */}
      <section
        aria-label="Inbox overview"
        className="flex flex-col justify-between gap-6 rounded-2xl bg-[#DCE5CC] px-7 py-6 sm:flex-row sm:items-center"
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4E6356]">
            YOUR UPDATES, IN ONE PLACE
          </p>
          <h1 className="mt-1 truncate font-serif text-3xl italic tracking-tight text-[#162B22] sm:text-[34px] sm:leading-tight">
            Inbox
          </h1>
          <p className="mt-1.5 text-[13px] text-[#3F5347]">
            Keep track of comments, mentions, and activity from your boards.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-5 border-t border-[#C4D1B1] pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
          <div>
            <p className="text-2xl font-semibold leading-none text-[#162B22]">
              {unread}
            </p>
            <p className="mt-1.5 text-xs text-[#4E6356]">unread updates</p>
          </div>
        </div>
      </section>

      {/* 2. Sub-bar Tabs & Mark All As Read */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6E8E3]">
        <div
          className="flex items-center gap-6"
          role="tablist"
          aria-label="Filter notifications"
        >
          {(["all", "unread"] as const).map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onFilterChange(f)}
                className={[
                  "inline-flex cursor-pointer items-center gap-1.5 border-b-2 pb-3 text-[13px] transition-colors",
                  active
                    ? "border-[#16382C] font-semibold text-[#162B22]"
                    : "border-transparent font-medium text-[#6E7A73] hover:text-[#162B22]",
                ].join(" ")}
              >
                <span>{f === "all" ? "All" : "Unread"}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pb-2">
          {isPreviewMode && (
            <button
              type="button"
              onClick={load}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#DCDFD8] bg-white px-3 py-1.5 text-xs font-medium text-[#3F5347] transition-colors hover:bg-[#F3F4F0]"
            >
              <RotateCcw size={13} strokeWidth={1.75} aria-hidden="true" />
              <span>Sync live</span>
            </button>
          )}

          <button
            type="button"
            disabled={unread === 0}
            onClick={() => void markAll()}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E6E8E3] bg-white px-3 py-1.5 text-xs font-medium text-[#3F5347] transition-colors hover:bg-[#FAFBF8] disabled:cursor-not-allowed disabled:border-[#ECEEE9] disabled:bg-[#F9FAF7] disabled:text-[#A3ABA6]"
          >
            <CheckCheck size={13} strokeWidth={1.75} aria-hidden="true" />
            <span>Mark all as read</span>
          </button>
        </div>
      </div>

      {/* 3. Notification List or Empty State */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#E6E8E3] bg-white px-6 py-20 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF2E6] text-[#4E6356]">
            <InboxIcon size={20} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <p className="mt-1 text-sm font-semibold text-[#162B22]">
            {filter === "unread"
              ? "No unread notifications."
              : "No notifications yet."}
          </p>
          <p className="max-w-sm text-xs leading-relaxed text-[#6E7A73]">
            Activity from your boards — new cards, comments, and mentions —
            will appear here.
          </p>

          {filter === "all" && !isPreviewMode && (
            <button
              type="button"
              onClick={handlePreviewNotifications}
              className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-lg bg-[#16382C] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#1E4A3B]"
            >
              Preview notifications
            </button>
          )}
        </div>
      ) : (
        <ul
          role="list"
          className="flex flex-col gap-2.5"
          aria-label={`${visible.length} notifications`}
        >
          {visible.map((n) => (
            <li key={n.id} id={`notification-${n.id}`}>
              <div
                className={[
                  "flex items-start gap-3.5 rounded-2xl border bg-white p-4 transition-colors",
                  n.is_read
                    ? "border-[#E6E8E3] opacity-80"
                    : "border-[#C4D1B1] border-l-4 border-l-[#16382C]",
                  highlightId === n.id ? "ring-2 ring-[#4E7A58]" : "",
                ].join(" ")}
              >
                <span
                  aria-hidden="true"
                  className={[
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    n.is_read
                      ? "bg-[#F3F4F0] text-[#7C8680]"
                      : "bg-[#DCE5CC] text-[#16382C]",
                  ].join(" ")}
                >
                  <Bell size={14} strokeWidth={1.75} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p
                      className={[
                        "truncate text-sm",
                        n.is_read
                          ? "font-medium text-[#4E6356]"
                          : "font-semibold text-[#162B22]",
                      ].join(" ")}
                    >
                      {n.title}
                    </p>
                    <time
                      dateTime={n.created_at}
                      className="shrink-0 text-xs text-[#7C8680]"
                    >
                      {relativeTime(n.created_at, now)}
                    </time>
                  </div>

                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#4E6356]">
                    {n.body}
                  </p>

                  {!n.is_read && (
                    <button
                      type="button"
                      onClick={() => void handleRead(n)}
                      className="mt-2.5 inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#16382C] transition-colors hover:bg-[#EBF0E2]"
                    >
                      <CheckCheck size={13} aria-hidden="true" />
                      <span>Mark as read</span>
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
 * Inbox — lists the user's notifications with an unread filter,
 * per-item "mark as read", "mark all as read", and an empty-state preview.
 */
export default function InboxPage() {
  const { token, isAuthLoading } = useRequireAuth();
  const [filter, setFilter] = useState<Filter>("all");

  return (
    <div className="flex min-h-full w-full flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8">
      {isAuthLoading || !token ? (
        <div
          className="flex flex-col items-center gap-3 rounded-2xl border border-[#E6E8E3] bg-white p-10"
          aria-busy="true"
          aria-label="Loading inbox"
        >
          <Loader2
            size={20}
            strokeWidth={1.5}
            aria-hidden="true"
            className="animate-spin text-[#6E7A73]"
          />
          <p className="text-sm text-[#6E7A73]">Loading…</p>
        </div>
      ) : (
        <Suspense fallback={null}>
          <InboxList
            token={token}
            filter={filter}
            onFilterChange={setFilter}
          />
        </Suspense>
      )}
    </div>
  );
}