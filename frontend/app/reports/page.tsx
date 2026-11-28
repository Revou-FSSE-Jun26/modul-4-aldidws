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
import type { Board, CardListItem, Paginated } from "@/lib/types/api";
import { getDueState } from "@/lib/dueDate";
import { BaseButton } from "@/components/shared/BaseButton";
import { ApiError } from "@/lib/errors";
import { showError } from "@/lib/toast";

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

const DONE_COLUMN_NAMES = new Set([
  "done",
  "completed",
  "complete",
  "finished",
  "archive",
  "archived",
]);

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

  const overdue = cards.filter(
    (c) => getDueState(c.due_date, now) === "overdue",
  ).length;
  const soon = cards.filter(
    (c) => getDueState(c.due_date, now) === "soon",
  ).length;
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
    completion:
      totalCards === 0 ? null : Math.round((doneCards / totalCards) * 100),
  };
}

function formatSnapshotLabel(updatedAt: Date | null, now: Date): string {
  if (!updatedAt) return "Just now";
  const diffSec = Math.floor((now.getTime() - updatedAt.getTime()) / 1000);
  if (diffSec < 45) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatTile({
  label,
  value,
  icon,
  iconBgClass,
  valueClass,
  hint,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBgClass: string;
  valueClass?: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3.5 rounded-2xl border border-[#E6E8E3] bg-white p-5">
      <span
        aria-hidden="true"
        className={[
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          iconBgClass,
        ].join(" ")}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[#6E7A73]">{label}</p>
        <p
          className={[
            "mt-1 text-2xl font-semibold leading-tight tracking-tight",
            valueClass ?? "text-[#162B22]",
          ].join(" ")}
        >
          {value}
        </p>
        {hint && (
          <p className="mt-1 truncate text-[11px] text-[#8C9590]">{hint}</p>
        )}
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
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative flex h-20 w-20 shrink-0 items-center justify-center"
        role="img"
        aria-label={`${label}: ${clamped}%`}
      >
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke="#ECEEE9"
            strokeWidth="6"
          />
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke="#16382C"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-[#162B22]">
          {clamped}%
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#162B22]">{label}</p>
        <p className="mt-0.5 text-xs text-[#7C8680]">
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
    | { status: "ready"; stats: ReportStats; updatedAt: Date }
    | { status: "error"; message: string };

  const [state, setState] = useState<FetchState>({ status: "idle" });
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  function load() {
    setState({ status: "loading" });
    const snapshotNow = new Date();
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
          snapshotNow,
        );
        setNow(snapshotNow);
        setState({ status: "ready", stats, updatedAt: snapshotNow });
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
      <div
        className="flex w-full flex-1 flex-col gap-5"
        aria-busy="true"
        aria-label="Loading reports"
      >
        <div className="h-32 animate-pulse rounded-2xl bg-[#DCE5CC]/70" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-[#E6E8E3] bg-white"
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-2xl border border-[#E6E8E3] bg-white"
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex w-full flex-1 flex-col gap-5">
        <section className="flex flex-col justify-between gap-4 rounded-2xl bg-[#DCE5CC] px-7 py-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4E6356]">
              A CLEAR VIEW OF YOUR WORK
            </p>
            <h1 className="mt-1 font-serif text-3xl italic tracking-tight text-[#162B22] sm:text-[34px] sm:leading-tight">
              Reports
            </h1>
            <p className="mt-1.5 text-[13px] text-[#3F5347]">
              Track momentum, spot priorities, and see what needs your attention.
            </p>
          </div>
        </section>

        <div className="rounded-2xl border border-[#E6E8E3] bg-white p-6">
          <p role="alert" className="text-sm text-[#3F5347]">
            {state.message}
          </p>
          <BaseButton
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3 cursor-pointer"
            onClick={load}
          >
            <RefreshCw size={14} aria-hidden="true" /> Try again
          </BaseButton>
        </div>
      </div>
    );
  }

  const { stats, updatedAt } = state;
  const isHealthy = stats.overdueCards === 0;
  const healthRatio =
    stats.totalCards === 0
      ? 100
      : Math.max(
          15,
          Math.round(
            ((stats.totalCards - stats.overdueCards) / stats.totalCards) * 100,
          ),
        );

  return (
    <div className="flex w-full flex-1 flex-col gap-5">
      {/* 1. Hero Banner (Sage Green Card) */}
      <section
        aria-label="Workspace reports overview"
        className="flex flex-col justify-between gap-6 rounded-2xl bg-[#DCE5CC] px-7 py-6 sm:flex-row sm:items-center"
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4E6356]">
            A CLEAR VIEW OF YOUR WORK
          </p>
          <h1 className="mt-1 truncate font-serif text-3xl italic tracking-tight text-[#162B22] sm:text-[34px] sm:leading-tight">
            Reports
          </h1>
          <p className="mt-1.5 text-[13px] text-[#3F5347]">
            Track momentum, spot priorities, and see what needs your attention.
          </p>
        </div>

        <div className="w-full shrink-0 sm:w-52">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5B7062]">
            WORKSPACE HEALTH
          </p>
          <p className="mt-1 text-xl font-semibold text-[#162B22]">
            {isHealthy ? "On track" : "Needs attention"}
          </p>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#C2D0B0]">
            <div
              className="h-full rounded-full bg-[#2B6E4E] transition-all duration-300"
              style={{ width: `${isHealthy ? 100 : healthRatio}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-[#5B7062]">
            {isHealthy
              ? "Nothing overdue"
              : `${stats.overdueCards} overdue ${stats.overdueCards === 1 ? "card" : "cards"}`}
          </p>
        </div>
      </section>

      {/* 2. Top Stat Tiles (4 Columns) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Boards"
          value={stats.totalBoards}
          icon={<Layers size={17} strokeWidth={1.75} aria-hidden="true" />}
          iconBgClass="bg-[#E8EEF9] text-[#365B9E]"
          hint={`${stats.favoriteBoards} pinned to sidebar`}
        />
        <StatTile
          label="My cards"
          value={stats.totalCards}
          icon={<Square size={17} strokeWidth={1.75} aria-hidden="true" />}
          iconBgClass="bg-[#F3F4F0] text-[#7C8680]"
          hint={`${stats.openCards} open, ${stats.doneCards} done`}
        />
        <StatTile
          label="Overdue"
          value={stats.overdueCards}
          icon={
            <AlertTriangle size={17} strokeWidth={1.75} aria-hidden="true" />
          }
          iconBgClass={
            stats.overdueCards > 0
              ? "bg-[#FCECE9] text-[#B33B24]"
              : "bg-[#E9F3EC] text-[#2B6E4E]"
          }
          valueClass={stats.overdueCards > 0 ? "text-[#B33B24]" : "text-[#162B22]"}
          hint={
            stats.overdueCards > 0
              ? `${stats.dueSoonCards} due soon`
              : "Nothing overdue"
          }
        />
        <StatTile
          label="Notifications"
          value={stats.unreadNotifications}
          icon={<Bell size={17} strokeWidth={1.75} aria-hidden="true" />}
          iconBgClass="bg-[#F3F4F0] text-[#7C8680]"
          hint={`${stats.totalNotifications} total`}
        />
      </div>

      {/* 3. Second Row: Completion + High-priority open + Due in 24h */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#E6E8E3] bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#162B22]">
            <BarChart3
              size={14}
              strokeWidth={1.75}
              aria-hidden="true"
              className="text-[#4E7A58]"
            />
            <span>Completion</span>
          </h2>
          {stats.completion !== null ? (
            <ProgressRing percent={stats.completion} label="Done" />
          ) : (
            <p className="text-xs text-[#7C8680]">
              No cards yet — completion will appear once you have at least one.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-[#E6E8E3] bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#162B22]">
            <Flag
              size={14}
              strokeWidth={1.75}
              aria-hidden="true"
              className="text-[#6E7A73]"
            />
            <span>High-priority open</span>
          </h2>
          <p className="text-2xl font-semibold text-[#162B22]">
            {stats.highPriorityCards}
          </p>
          <p className="mt-1.5 text-xs text-[#7C8680]">
            {stats.highPriorityCards === 0
              ? "No high-priority cards."
              : "Cards marked high priority that are still open."}
          </p>
        </div>

        <div className="rounded-2xl border border-[#E6E8E3] bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#162B22]">
            <Timer
              size={14}
              strokeWidth={1.75}
              aria-hidden="true"
              className="text-[#6E7A73]"
            />
            <span>Due in 24h</span>
          </h2>
          <p className="text-2xl font-semibold text-[#162B22]">
            {stats.dueSoonCards}
          </p>
          <p className="mt-1.5 text-xs text-[#7C8680]">
            {stats.dueSoonCards === 0
              ? "Nothing due in the next 24 hours."
              : "Open cards due within the next 24 hours."}
          </p>
        </div>
      </div>

      {/* 4. Snapshot Footer & Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={load}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E6E8E3] bg-white px-3.5 py-1.5 text-xs font-medium text-[#162B22] transition-colors hover:bg-[#FAFBF8]"
        >
          <RefreshCw size={13} strokeWidth={1.75} aria-hidden="true" />
          <span>Refresh</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Reports — at-a-glance dashboard of your workspace: boards, your cards
 * (open / done / overdue / due-soon / high-priority), notifications, and
 * completion rate.
 */
export default function ReportsPage() {
  const { token, isAuthLoading } = useRequireAuth();

  return (
    <div className="flex min-h-full w-full flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8">
      {isAuthLoading || !token ? (
        <div
          className="flex flex-col items-center gap-3 rounded-2xl border border-[#E6E8E3] bg-white p-10"
          aria-busy="true"
          aria-label="Loading reports"
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
        <ReportsContent token={token} />
      )}
    </div>
  );
}