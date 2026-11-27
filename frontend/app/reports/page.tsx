"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Layers,
  Square,
  AlertTriangle,
  Bell,
  BarChart3,
  Loader2,
  RefreshCw,
  Flag,
  Timer,
} from "lucide-react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { loginPath } from "@/lib/loginPath";
import { listBoards } from "@/lib/services/boardsService";
import { listCards } from "@/lib/services/cardsService";
import { listNotifications } from "@/lib/services/notificationsService";
import type { CardListItem, Paginated } from "@/lib/types/api";
import { getDueState } from "@/lib/dueDate";
import { BaseButton } from "@/components/shared/BaseButton";
import { ApiError } from "@/lib/errors";
import { showError } from "@/lib/toast";
import { BoardBgWrapper } from "@/components/board/BoardBgWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import type { Board } from "@/lib/types/api";

/**
 * Fetch every page of `GET /api/v1/cards?mine=true` and concatenate.
 *
 * `meta.total` is the authoritative count; we keep paging until we have that
 * many rows (capped at 10 pages to bound the cost of a pathological backend).
 */
async function listAllMyCards(token: string): Promise<CardListItem[]> {
  const PER_PAGE = 100;
  const MAX_PAGES = 10;
  const first: Paginated<CardListItem> = await listCards(token, {
    mine: true,
    per_page: PER_PAGE,
    page: 1,
  });
  const all: CardListItem[] = [...first.data];
  const total = first.meta?.total ?? all.length;

  for (let page = 2; page <= MAX_PAGES && all.length < total; page++) {
    const next: Paginated<CardListItem> = await listCards(token, {
      mine: true,
      per_page: PER_PAGE,
      page,
    });
    if (next.data.length === 0) break;
    all.push(...next.data);
  }
  return all;
}

// ---------------------------------------------------------------------------
// Stats types
// ---------------------------------------------------------------------------

interface ReportStats {
  totalBoards: number;
  favoriteBoards: number;
  totalCards: number;
  doneCards: number;
  openCards: number;
  overdueCards: number;
  dueSoonCards: number;
  highPriorityCards: number;
  unreadNotifications: number;
  totalNotifications: number;
  /** Completion = done / total. Null when there are no cards. */
  completion: number | null;
}

/**
 * Heuristic for "done" columns. We can't reliably know which column a board
 * marks as done without an `is_done` flag on the card list, so we use a small
 * set of common names. This is intentional — the Reports page is a snapshot,
 * not a canonical "done" counter. If your board names its done column
 * something else, it will be counted as open.
 */
const DONE_COLUMN_NAMES = new Set(["done", "completed", "complete", "finished", "archive", "archived"]);

function computeStats(
  boards: Board[],
  cards: CardListItem[],
  notifications: { total: number; unread: number },
  now: Date,
): ReportStats {
  const totalCards = cards.length;
  const doneCards = cards.filter((c) => {
    const name = (c.column_name ?? "").trim().toLowerCase();
    return DONE_COLUMN_NAMES.has(name);
  }).length;
  const openCards = totalCards - doneCards;

  const overdue = cards.filter((c) => getDueState(c.due_date, now) === "overdue").length;
  const soon = cards.filter((c) => getDueState(c.due_date, now) === "soon").length;
  const highPriority = cards.filter((c) => c.priority === "high").length;

  return {
    totalBoards: boards.length,
    favoriteBoards: boards.filter((b) => b.is_favorite).length,
    totalCards,
    doneCards,
    openCards,
    overdueCards: overdue,
    dueSoonCards: soon,
    highPriorityCards: highPriority,
    unreadNotifications: notifications.unread,
    totalNotifications: notifications.total,
    completion: totalCards === 0 ? null : Math.round((doneCards / totalCards) * 100),
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatTile({
  label,
  value,
  icon,
  accent,
  hint,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: "default" | "success" | "warning" | "danger" | "brand";
  hint?: string;
}) {
  const accentClasses: Record<string, string> = {
    default: "text-[var(--text-secondary)]",
    success: "text-[var(--pill-green)]",
    warning: "text-[var(--pill-orange)]",
    danger: "text-[var(--accent-red)]",
    brand: "text-[var(--brand)]",
  };
  const iconClasses: Record<string, string> = {
    default: "bg-[var(--bg-hover)] text-[var(--text-muted)]",
    success: "bg-[var(--col-green-bg)] text-[var(--col-green-fg)]",
    warning: "bg-[var(--col-orange-bg)] text-[var(--col-orange-fg)]",
    danger: "bg-[var(--col-red-bg)] text-[var(--col-red-fg)]",
    brand: "bg-[var(--brand-soft)] text-[var(--brand)]",
  };

  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-panel)] p-4 shadow-[var(--shadow-card)]">
      <span
        aria-hidden="true"
        className={[
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-ctrl)]",
          iconClasses[accent ?? "default"] ?? iconClasses.default,
        ].join(" ")}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>
        <p
          className={[
            "mt-0.5 text-2xl font-semibold tracking-tight",
            accentClasses[accent ?? "default"] ?? accentClasses.default,
          ].join(" ")}
        >
          {value}
        </p>
        {hint && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{hint}</p>}
      </div>
    </div>
  );
}

function ProgressRing({
  percent,
  label,
}: {
  percent: number;
  label: string;
}) {
  // r=34, stroke=6 → circumference ≈ 207.35
  const C = 2 * Math.PI * 34;
  const offset = C * (1 - percent / 100);
  return (
    <div className="flex items-center gap-4">
      <div
        className="relative h-20 w-20"
        role="img"
        aria-label={`${label}: ${percent}%`}
      >
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
          <circle
            cx="40"
            cy="40"
            r="34"
            fill="none"
            stroke="var(--bg-hover)"
            strokeWidth="6"
          />
          <circle
            cx="40"
            cy="40"
            r="34"
            fill="none"
            stroke="var(--brand)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-[var(--text-primary)]">
          {percent}%
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-muted)]">
          Done cards out of all of your cards
        </p>
      </div>
    </div>
  );
}

function ReportsContent({ token }: { token: string }) {
  const router = useRouter();
  const pathname = usePathname();

  type FetchState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; stats: ReportStats }
    | { status: "error"; message: string };

  const [state, setState] = useState<FetchState>({ status: "idle" });
  const [now] = useState(() => new Date());

  function load() {
    setState({ status: "loading" });
    Promise.all([
      listBoards(token),
      listAllMyCards(token),
      listNotifications(token),
    ])
      .then(([boards, cards, notifs]) => {
        const stats = computeStats(
          boards,
          cards,
          { total: notifs.items.length, unread: notifs.unreadCount },
          now,
        );
        setState({ status: "ready", stats });
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.isUnauthorized) {
          router.replace(loginPath(pathname));
          return;
        }
        const message =
          err instanceof ApiError ? err.message : "Could not load reports.";
        setState({ status: "error", message });
        showError(message);
      });
  }

  useEffect(load, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.status === "idle" || state.status === "loading") {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading reports">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-panel)]"
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="h-32 animate-pulse rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-panel)]" aria-hidden="true" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-panel)] p-6">
        <p role="alert" className="text-sm text-[var(--text-secondary)]">
          {state.message}
        </p>
        <BaseButton variant="secondary" className="mt-3" onClick={load}>
          <RefreshCw size={14} aria-hidden="true" /> Try again
        </BaseButton>
      </div>
    );
  }

  const { stats } = state;

  return (
    <div className="flex flex-col gap-6">
      {/* Top stat tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Boards"
          value={stats.totalBoards}
          icon={<Layers size={18} strokeWidth={1.5} aria-hidden="true" />}
          accent="brand"
          hint={`${stats.favoriteBoards} pinned to sidebar`}
        />
        <StatTile
          label="My cards"
          value={stats.totalCards}
          icon={<Square size={18} strokeWidth={1.5} aria-hidden="true" />}
          accent="default"
          hint={`${stats.openCards} open, ${stats.doneCards} done`}
        />
        <StatTile
          label="Overdue"
          value={stats.overdueCards}
          icon={<AlertTriangle size={18} strokeWidth={1.5} aria-hidden="true" />}
          accent={stats.overdueCards > 0 ? "danger" : "success"}
          hint={
            stats.overdueCards > 0
              ? `${stats.dueSoonCards} due soon`
              : "Nothing overdue"
          }
        />
        <StatTile
          label="Notifications"
          value={stats.unreadNotifications}
          icon={<Bell size={18} strokeWidth={1.5} aria-hidden="true" />}
          accent={stats.unreadNotifications > 0 ? "warning" : "default"}
          hint={`${stats.totalNotifications} total`}
        />
      </div>

      {/* Second row: completion + priority + due soon */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-panel)] p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
            <BarChart3 size={14} aria-hidden="true" className="mr-1.5 inline text-[var(--brand)]" />
            Completion
          </h2>
          {stats.completion !== null ? (
            <ProgressRing percent={stats.completion} label="Done" />
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              No cards yet — completion will appear once you have at least one.
            </p>
          )}
        </div>

        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-panel)] p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
            <Flag size={14} aria-hidden="true" className="mr-1.5 inline text-[var(--brand)]" />
            High-priority open
          </h2>
          <p className="text-2xl font-semibold text-[var(--text-primary)]">
            {stats.highPriorityCards}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {stats.highPriorityCards === 0
              ? "No high-priority cards."
              : "Cards marked high priority that are still open."}
          </p>
        </div>

        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-panel)] p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
            <Timer size={14} aria-hidden="true" className="mr-1.5 inline text-[var(--brand)]" />
            Due in 24h
          </h2>
          <p className="text-2xl font-semibold text-[var(--text-primary)]">
            {stats.dueSoonCards}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {stats.dueSoonCards === 0
              ? "Nothing due in the next 24 hours."
              : "Open cards due within the next 24 hours."}
          </p>
        </div>
      </div>

      {/* Refresh */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-muted)]">
          Snapshot updated {now.toLocaleString()}
        </p>
        <BaseButton variant="secondary" size="sm" onClick={load}>
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </BaseButton>
      </div>
    </div>
  );
}

/**
 * Reports — at-a-glance dashboard of your workspace: boards, your cards
 * (open / done / overdue / due-soon / high-priority), notifications, and
 * completion rate.
 *
 * All data comes from existing backend endpoints: GET /api/boards,
 * GET /api/v1/cards?mine=true, GET /api/notifications.
 */
export default function ReportsPage() {
  const { token, isAuthLoading } = useRequireAuth();

  return (
    <BoardBgWrapper className="flex flex-1 flex-col">
      <PageHeader
        title="Reports"
        description="Your workspace at a glance."
        icon={<BarChart3 size={16} strokeWidth={1.5} />}
      />
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          {isAuthLoading || !token ? (
            <div
              className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-panel)] p-10"
              aria-busy="true"
              aria-label="Loading reports"
            >
              <Loader2
                size={20}
                strokeWidth={1.5}
                aria-hidden="true"
                className="animate-spin text-[var(--text-muted)]"
              />
              <p className="text-sm text-[var(--text-muted)]">Loading…</p>
            </div>
          ) : (
            <ReportsContent token={token} />
          )}
        </div>
      </main>
    </BoardBgWrapper>
  );
}
