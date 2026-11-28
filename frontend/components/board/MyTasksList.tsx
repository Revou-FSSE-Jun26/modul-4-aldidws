"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useNow } from "@/hooks/useNow";
import { createCard, listCards } from "@/lib/services/cardsService";
import { getBoard, listBoards } from "@/lib/services/boardsService";
import { ApiError } from "@/lib/errors";
import { loginPath } from "@/lib/loginPath";
import { showError, showSuccess } from "@/lib/toast";
import type { CardListItem, CardPriority, LabelColor } from "@/lib/types/api";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";
import { ActionMenu } from "@/components/shared/ActionMenu";
import {
  ArrowUpDown,
  Calendar as CalendarIcon,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Kanban,
  List,
  Lock,
  MoreHorizontal,
  Plus,
  Search,
  Star,
  User,
  UserPlus,
  X,
} from "lucide-react";

const PER_PAGE = 50;

type MyTaskView = "list" | "board" | "calendar";
type GroupByMode = "status" | "priority" | "board";
type SortByMode = "manual" | "due_date" | "priority" | "title";

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: CardListItem[]; page: number; total: number };

interface BoardColumnOption {
  boardId: string;
  boardName: string;
  columnId: string;
  columnName: string;
}

const LABEL_STRIP_STYLES: Record<LabelColor, string> = {
  blue: "bg-[#3B82F6]",
  sky: "bg-[#38BDF8]",
  graphite: "bg-[#64748B]",
  silver: "bg-[#CBD5E1]",
  red: "bg-[#EF4444]",
  orange: "bg-[#F97316]",
  green: "bg-[#22C55E]",
  purple: "bg-[#A855F7]",
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  "to do": "bg-[#EAECE6] text-[#4E6356] border-transparent",
  todo: "bg-[#EAECE6] text-[#4E6356] border-transparent",
  "in progress": "bg-[#FEF0E6] text-[#B86823] border-transparent",
  "in review": "bg-[#F3E8FF] text-[#6B3FA0] border-transparent",
  done: "bg-[#DCE5CC] text-[#1D4E38] border-transparent",
  completed: "bg-[#DCE5CC] text-[#1D4E38] border-transparent",
};

const PRIORITY_META: Record<
  CardPriority,
  { label: string; dotClass: string; textClass: string }
> = {
  low: {
    label: "Low",
    dotClass: "bg-[#8B92A0]",
    textClass: "text-[#6E7A73]",
  },
  medium: {
    label: "Medium",
    dotClass: "bg-[#C48B28]",
    textClass: "text-[#9A6B19]",
  },
  high: {
    label: "High",
    dotClass: "bg-[#C84B31]",
    textClass: "text-[#B33B24]",
  },
};

function formatMonthDay(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
  });
}

function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function isDoneColumn(columnName?: string): boolean {
  const normalized = (columnName ?? "").trim().toLowerCase();
  return normalized === "done" || normalized === "completed";
}

/**
 * Cards the signed-in user created, grouped by status, priority, or board.
 * Loads GET /api/v1/cards?mine=true with "Load more" paging. Real errors are
 * shown; nothing is silently turned into an empty list.
 */
export function MyTasksList() {
  const router = useRouter();
  const pathname = usePathname();
  const { token, isAuthLoading, user } = useRequireAuth();
  useNow();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const newTaskTitleRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<ListState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  const [taskView, setTaskView] = useState<MyTaskView>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortByMode>("manual");
  const [groupBy, setGroupBy] = useState<GroupByMode>("status");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [isFavorite, setIsFavorite] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // New task modal state
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [boardTargets, setBoardTargets] = useState<BoardColumnOption[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [selectedTargetKey, setSelectedTargetKey] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<CardPriority>("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskError, setNewTaskError] = useState<string | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  useEffect(() => {
    if (isAuthLoading || !token) return;
    let cancelled = false;
    listCards(token, { mine: true, page: 1, per_page: PER_PAGE })
      .then(({ data, meta }) => {
        if (!cancelled) {
          setState({
            status: "ready",
            items: data,
            page: meta.page,
            total: meta.total,
          });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.isUnauthorized) {
          router.replace(loginPath(pathname));
          return;
        }
        setState({
          status: "error",
          message:
            err instanceof Error ? err.message : "Could not load your tasks.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [token, isAuthLoading, attempt, router, pathname]);

  useEffect(() => {
    function handleShortcut(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        document.activeElement?.tagName !== "SELECT"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!isNewTaskOpen) return;
    requestAnimationFrame(() => {
      newTaskTitleRef.current?.focus();
    });
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && !isCreatingTask) {
        setIsNewTaskOpen(false);
        setNewTaskError(null);
      }
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isNewTaskOpen, isCreatingTask]);

  const loadBoardColumnTargets = useCallback(async () => {
    if (!token) return;
    setLoadingTargets(true);
    try {
      const boards = await listBoards(token);
      const details = await Promise.all(
        (boards ?? []).map(async (b) => {
          try {
            const full = await getBoard(token, b.id);
            const sortedCols = [...(full.columns ?? [])].sort(
              (a, bCol) => a.position - bCol.position,
            );
            return sortedCols.map((col) => ({
              boardId: b.id,
              boardName: full.name || b.name,
              columnId: col.id,
              columnName: col.name,
            }));
          } catch {
            return [] as BoardColumnOption[];
          }
        }),
      );
      const flattened = details.flat();
      setBoardTargets(flattened);
      if (flattened.length > 0 && !selectedTargetKey) {
        setSelectedTargetKey(`${flattened[0].boardId}::${flattened[0].columnId}`);
      }
    } catch {
      // Keep empty if loading targets fails
    } finally {
      setLoadingTargets(false);
    }
  }, [token, selectedTargetKey]);

  function openNewTaskModal(presetSection?: string) {
    setNewTaskTitle("");
    setNewTaskDueDate("");
    setNewTaskError(null);

    if (groupBy === "priority" && presetSection) {
      const p = presetSection.toLowerCase();
      if (p === "high" || p === "medium" || p === "low") {
        setNewTaskPriority(p);
      } else {
        setNewTaskPriority("medium");
      }
    } else {
      setNewTaskPriority("medium");
    }

    if (boardTargets.length > 0) {
      if (groupBy === "board" && presetSection) {
        const matched = boardTargets.find(
          (t) => t.boardName.toLowerCase() === presetSection.toLowerCase(),
        );
        if (matched) setSelectedTargetKey(`${matched.boardId}::${matched.columnId}`);
      } else if (groupBy === "status" && presetSection) {
        const matched = boardTargets.find(
          (t) => t.columnName.toLowerCase() === presetSection.toLowerCase(),
        );
        if (matched) setSelectedTargetKey(`${matched.boardId}::${matched.columnId}`);
      } else if (!selectedTargetKey) {
        setSelectedTargetKey(`${boardTargets[0].boardId}::${boardTargets[0].columnId}`);
      }
    } else if (token) {
      void loadBoardColumnTargets();
    }

    setIsNewTaskOpen(true);
  }

  async function handleCreateNewTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedTitle = newTaskTitle.trim();
    if (!trimmedTitle) {
      setNewTaskError("Task name is required.");
      return;
    }
    if (!token || state.status !== "ready") return;

    const chosenTarget =
      boardTargets.find((t) => `${t.boardId}::${t.columnId}` === selectedTargetKey) ??
      boardTargets[0];

    if (!chosenTarget) {
      setNewTaskError("No board column found. Please create a board first.");
      return;
    }

    setIsCreatingTask(true);
    setNewTaskError(null);
    try {
      const created = await createCard(token, chosenTarget.columnId, {
        title: trimmedTitle,
        priority: newTaskPriority,
        due_date: newTaskDueDate ? newTaskDueDate : undefined,
      });

      const createdListItem: CardListItem = {
        ...created,
        board_id: chosenTarget.boardId,
        board_name: chosenTarget.boardName,
        column_name: chosenTarget.columnName,
      };

      setState((prev) =>
        prev.status === "ready"
          ? {
              ...prev,
              items: [createdListItem, ...prev.items],
              total: prev.total + 1,
            }
          : prev,
      );
      setIsNewTaskOpen(false);
      setNewTaskTitle("");
      setNewTaskDueDate("");
      showSuccess("Task added");
    } catch (err: unknown) {
      if (err instanceof ApiError && err.isUnauthorized) {
        router.replace(loginPath(pathname));
        return;
      }
      setNewTaskError(
        err instanceof Error && err.message ? err.message : "Could not create task.",
      );
      showError("Could not create task.");
    } finally {
      setIsCreatingTask(false);
    }
  }

  function handleToggleComplete(cardId: string) {
    setState((prev) => {
      if (prev.status !== "ready") return prev;
      return {
        ...prev,
        items: prev.items.map((c) => {
          if (c.id !== cardId) return c;
          const currentlyDone = isDoneColumn(c.column_name);
          return {
            ...c,
            column_name: currentlyDone ? "To do" : "Done",
          };
        }),
      };
    });
  }

  async function handleLoadMore() {
    if (state.status !== "ready" || !token) return;
    setIsLoadingMore(true);
    setMoreError(null);
    try {
      const { data, meta } = await listCards(token, {
        mine: true,
        page: state.page + 1,
        per_page: PER_PAGE,
      });
      setState({
        status: "ready",
        items: [...state.items, ...data],
        page: meta.page,
        total: meta.total,
      });
    } catch (err: unknown) {
      setMoreError(
        err instanceof Error ? err.message : "Could not load more tasks.",
      );
    } finally {
      setIsLoadingMore(false);
    }
  }

  const items = state.status === "ready" ? state.items : [];

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = items.filter((c) => {
      const matchSearch =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.board_name.toLowerCase().includes(q) ||
        c.column_name.toLowerCase().includes(q);
      const matchPriority =
        filterPriority === "all" ||
        (c.priority ?? "low").toLowerCase() === filterPriority.toLowerCase();
      return matchSearch && matchPriority;
    });

    const priorityRank: Record<string, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    if (sortBy === "title") {
      return [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sortBy === "priority") {
      return [...list].sort(
        (a, b) =>
          (priorityRank[(a.priority ?? "low").toLowerCase()] ?? 3) -
          (priorityRank[(b.priority ?? "low").toLowerCase()] ?? 3),
      );
    }
    if (sortBy === "due_date") {
      return [...list].sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
    }
    return list;
  }, [items, searchQuery, filterPriority, sortBy]);

  const groupedSections = useMemo(() => {
    const groups = new Map<string, CardListItem[]>();

    if (groupBy === "status") {
      const defaultOrder = ["To do", "In progress", "In review", "Done"];
      for (const name of defaultOrder) groups.set(name, []);
      for (const item of filteredAndSorted) {
        const key = item.column_name?.trim() || "To do";
        const existing = groups.get(key);
        if (existing) existing.push(item);
        else groups.set(key, [item]);
      }
      return Array.from(groups.entries()).filter(
        ([key, list]) => list.length > 0 || defaultOrder.includes(key),
      );
    }

    if (groupBy === "priority") {
      for (const key of ["High", "Medium", "Low"]) groups.set(key, []);
      for (const item of filteredAndSorted) {
        const p = (item.priority ?? "low").toLowerCase();
        const key = p === "high" ? "High" : p === "medium" ? "Medium" : "Low";
        groups.get(key)?.push(item);
      }
      return Array.from(groups.entries()).filter(([, list]) => list.length > 0);
    }

    for (const item of filteredAndSorted) {
      const key = item.board_name?.trim() || "General";
      const existing = groups.get(key) ?? [];
      existing.push(item);
      groups.set(key, existing);
    }
    return Array.from(groups.entries());
  }, [filteredAndSorted, groupBy]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ dateStr: string | null; dayNumber: number | null }> = [];

    for (let i = 0; i < firstDayWeekday; i++) {
      cells.push({ dateStr: null, dayNumber: null });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const mm = String(month + 1).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      cells.push({ dateStr: `${year}-${mm}-${dd}`, dayNumber: day });
    }
    return cells;
  }, [calendarMonth]);

  const cardsByDate = useMemo(() => {
    const map: Record<string, CardListItem[]> = {};
    for (const item of filteredAndSorted) {
      if (!item.due_date) continue;
      const key = toLocalDateKey(item.due_date);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }, [filteredAndSorted]);

  if (isAuthLoading || !token || state.status === "loading") {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading tasks">
        <div className="h-40 animate-pulse rounded-2xl bg-[#DCE5CC]/70" />
        <div className="h-10 w-72 animate-pulse rounded-lg bg-[#EAECE6]" />
        <div className="h-64 animate-pulse rounded-xl border border-[#E6E8E3] bg-white" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col items-start gap-3">
        <div
          role="alert"
          className="w-full rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.message}
        </div>
        <BaseButton
          variant="secondary"
          onClick={() => {
            setState({ status: "loading" });
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </BaseButton>
      </div>
    );
  }

  const totalCount = state.total;
  const completedCount = state.items.filter((c) => isDoneColumn(c.column_name)).length;
  const completionPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const hasMore = state.page * PER_PAGE < state.total;
  const ownerName = user?.name?.trim() || user?.email?.split("@")[0] || "your";

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* 1. Hero Banner (Sage Green Card) */}
      <section
        aria-label="My tasks summary"
        className="relative flex flex-col justify-between gap-6 rounded-2xl bg-[#DCE5CC] px-7 py-6 sm:flex-row sm:items-stretch"
      >
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4E6356]">
              PERSONAL / OVERVIEW
            </p>
            <h1 className="mt-1 truncate font-serif text-3xl italic tracking-tight text-[#162B22] sm:text-[34px] sm:leading-tight">
              My Tasks
            </h1>
            <div className="group/md -mx-2 mt-1.5 max-w-2xl rounded-lg px-2 py-1 transition-colors hover:bg-[#CFDAB9]/75">
              <p className="text-[13px] text-[#3F5347] transition-colors group-hover/md:text-[#162B22]">
                Your next steps, all in one place. Make room for what matters.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2.5 text-xs text-[#465B4F]">
            <span className="inline-flex items-center gap-1.5">
              <Lock size={13} strokeWidth={1.75} aria-hidden="true" />
              <span>Only your tasks</span>
            </span>
            <span aria-hidden="true" className="text-[#788B7E]">
              ·
            </span>
            <span className="inline-flex items-center gap-1.5">
              <User size={13} strokeWidth={1.75} aria-hidden="true" />
              <span>{ownerName}&apos;s workspace</span>
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col justify-between sm:items-end">
          <div className="flex items-center gap-1 self-end">
            <button
              type="button"
              onClick={() => setIsFavorite((v) => !v)}
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              aria-pressed={isFavorite}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#2C4236] transition-colors hover:bg-black/5"
            >
              <Star
                size={16}
                strokeWidth={1.75}
                className={isFavorite ? "fill-[#D99B26] text-[#D99B26]" : ""}
              />
            </button>
            <ActionMenu
              label="My Tasks options"
              symbolNode={<MoreHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />}
              triggerClassName="h-8 w-8 cursor-pointer border-0 bg-transparent text-[#2C4236] hover:bg-black/5"
              items={[
                {
                  id: "prio-all",
                  label: `${filterPriority === "all" ? "✓ " : ""}All priorities`,
                  onSelect: () => setFilterPriority("all"),
                },
                {
                  id: "prio-high",
                  label: `${filterPriority === "high" ? "✓ " : ""}High priority only`,
                  onSelect: () => setFilterPriority("high"),
                },
                {
                  id: "refresh",
                  label: "Refresh tasks",
                  onSelect: () => {
                    setState({ status: "loading" });
                    setAttempt((n) => n + 1);
                  },
                },
              ]}
            />
          </div>

          <div className="mt-4 sm:mt-6 sm:min-w-[210px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4E6356]">
              A LITTLE PROGRESS, EVERY DAY
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tracking-tight text-[#162B22]">
                {completedCount} of {totalCount}
              </span>
              <span className="text-xs text-[#465B4F]">tasks complete</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={completionPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="My tasks completion progress"
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#C3D0AF]"
            >
              <div
                className="h-full rounded-full bg-[#16382C] transition-all duration-300"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-[#465B4F]">
              {completionPct}% complete
            </p>
          </div>
        </div>
      </section>

      {/* 2. View Switcher Tabs & Right Action */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#E6E8E3]">
        <div role="tablist" aria-label="My task views" className="flex items-center gap-6">
          <button
            type="button"
            role="tab"
            aria-selected={taskView === "list"}
            onClick={() => setTaskView("list")}
            className={`inline-flex cursor-pointer items-center gap-2 border-b-2 pb-3 text-[13px] font-medium transition-colors ${
              taskView === "list"
                ? "border-[#16382C] text-[#162B22]"
                : "border-transparent text-[#6E7A73] hover:text-[#162B22]"
            }`}
          >
            <List size={15} strokeWidth={1.75} aria-hidden="true" />
            <span>List</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={taskView === "board"}
            onClick={() => setTaskView("board")}
            className={`inline-flex cursor-pointer items-center gap-2 border-b-2 pb-3 text-[13px] font-medium transition-colors ${
              taskView === "board"
                ? "border-[#16382C] text-[#162B22]"
                : "border-transparent text-[#6E7A73] hover:text-[#162B22]"
            }`}
          >
            <Kanban size={15} strokeWidth={1.75} aria-hidden="true" />
            <span>Board</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={taskView === "calendar"}
            onClick={() => setTaskView("calendar")}
            className={`inline-flex cursor-pointer items-center gap-2 border-b-2 pb-3 text-[13px] font-medium transition-colors ${
              taskView === "calendar"
                ? "border-[#16382C] text-[#162B22]"
                : "border-transparent text-[#6E7A73] hover:text-[#162B22]"
            }`}
          >
            <CalendarIcon size={15} strokeWidth={1.75} aria-hidden="true" />
            <span>Calendar</span>
          </button>
        </div>

        <div className="pb-2.5">
          <Link
            href="/"
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#DCDFD8] bg-white px-3 text-xs font-medium text-[#1A2E26] shadow-2xs transition-colors hover:bg-[#F3F4F0]"
          >
            <UserPlus size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>All boards</span>
          </Link>
        </div>
      </div>

      {/* 3. Filter, Search & Primary Actions Toolbar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex h-8.5 w-48 items-center gap-2 rounded-lg border border-[#DCDFD8] bg-[#F0F0EA] px-2.5 transition-colors focus-within:border-[#16382C] focus-within:bg-white sm:w-56">
            <Search
              size={14}
              strokeWidth={1.75}
              className="shrink-0 text-[#7C8178]"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  if (searchQuery) setSearchQuery("");
                  else searchInputRef.current?.blur();
                }
              }}
              placeholder="Search my tasks..."
              aria-label="Search my tasks"
              className="w-full min-w-0 bg-transparent text-xs text-[#24483D] outline-none placeholder:text-[#92968D] [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                aria-label="Clear task search"
                className="shrink-0 cursor-pointer rounded p-0.5 text-[#7C8178] transition-colors hover:text-[#24483D]"
              >
                <X size={13} strokeWidth={1.75} aria-hidden="true" />
              </button>
            ) : (
              <kbd className="hidden shrink-0 rounded border border-[#E1E0D8] bg-white/70 px-1 text-[10px] text-[#92968D] sm:inline">
                /
              </kbd>
            )}
          </label>

          <ActionMenu
            label="Sort tasks"
            symbolNode={
              <span className="inline-flex items-center gap-1.5 px-2.5 text-xs font-medium text-[#1A2E26]">
                <ArrowUpDown size={13} strokeWidth={1.75} aria-hidden="true" />
                <span>Sort</span>
              </span>
            }
            triggerClassName="h-8.5 w-auto cursor-pointer rounded-lg border border-[#DCDFD8] bg-white hover:bg-[#F3F4F0]"
            items={[
              {
                id: "sort-manual",
                label: `${sortBy === "manual" ? "✓ " : ""}Manual order`,
                onSelect: () => setSortBy("manual"),
              },
              {
                id: "sort-due",
                label: `${sortBy === "due_date" ? "✓ " : ""}Due date`,
                onSelect: () => setSortBy("due_date"),
              },
              {
                id: "sort-priority",
                label: `${sortBy === "priority" ? "✓ " : ""}Priority`,
                onSelect: () => setSortBy("priority"),
              },
              {
                id: "sort-title",
                label: `${sortBy === "title" ? "✓ " : ""}Title (A–Z)`,
                onSelect: () => setSortBy("title"),
              },
            ]}
          />

          <span className="pl-1 text-xs text-[#6E7A73]">
            {filteredAndSorted.length} tasks
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#6E7A73]">Group by</span>
            <ActionMenu
              label="Group tasks by"
              symbolNode={
                <span className="inline-flex items-center gap-1.5 px-2.5 text-xs font-medium text-[#1A2E26]">
                  <span>
                    {groupBy === "priority"
                      ? "Priority"
                      : groupBy === "board"
                        ? "Board"
                        : "Status"}
                  </span>
                  <ChevronDown size={13} strokeWidth={1.75} aria-hidden="true" />
                </span>
              }
              triggerClassName="h-8.5 w-auto cursor-pointer rounded-lg border border-[#DCDFD8] bg-white hover:bg-[#F3F4F0]"
              items={[
                {
                  id: "group-status",
                  label: `${groupBy === "status" ? "✓ " : ""}Status`,
                  onSelect: () => setGroupBy("status"),
                },
                {
                  id: "group-priority",
                  label: `${groupBy === "priority" ? "✓ " : ""}Priority`,
                  onSelect: () => setGroupBy("priority"),
                },
                {
                  id: "group-board",
                  label: `${groupBy === "board" ? "✓ " : ""}Board`,
                  onSelect: () => setGroupBy("board"),
                },
              ]}
            />
          </div>

          <BaseButton
            size="sm"
            onClick={() => openNewTaskModal()}
            className="cursor-pointer"
          >
            <Plus size={14} strokeWidth={2} aria-hidden="true" />
            <span>New task</span>
          </BaseButton>

          <ActionMenu
            label="More task actions"
            symbolNode={<MoreHorizontal size={15} strokeWidth={1.75} aria-hidden="true" />}
            triggerClassName="h-8.5 w-8.5 cursor-pointer rounded-lg border border-[#DCDFD8] bg-white text-[#1A2E26] hover:bg-[#F3F4F0]"
            items={[
              {
                id: "filter-all",
                label: `${filterPriority === "all" ? "✓ " : ""}All priorities`,
                onSelect: () => setFilterPriority("all"),
              },
              {
                id: "filter-high",
                label: `${filterPriority === "high" ? "✓ " : ""}High priority`,
                onSelect: () => setFilterPriority("high"),
              },
              {
                id: "reset-all",
                label: "Reset filters & sort",
                onSelect: () => {
                  setSearchQuery("");
                  setFilterPriority("all");
                  setSortBy("manual");
                  setGroupBy("status");
                },
              },
            ]}
          />
        </div>
      </div>

      {/* 4. Task Table / Groups */}
      <div className="mt-4 flex-1">
        {state.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#CFD3CA] bg-white/70 px-6 py-16 text-center">
            <CheckSquare className="mb-3 h-10 w-10 text-[#6E7A73]" />
            <h3 className="text-base font-semibold text-[#1A2E26]">No tasks yet</h3>
            <p className="mt-1 max-w-sm text-xs text-[#6E7A73]">
              You haven&apos;t created any cards yet. Click &ldquo;New task&rdquo; or{" "}
              <Link href="/" className="font-medium text-[#16382C] underline">
                go to your boards
              </Link>{" "}
              to get started.
            </p>
          </div>
        ) : taskView === "board" ? (
          <div className="flex snap-x snap-mandatory items-start gap-4 overflow-x-auto px-1 pt-1 pb-4">
            {groupedSections.map(([sectionTitle, groupCards]) => (
              <div
                key={sectionTitle}
                className="w-72 shrink-0 rounded-xl border border-[#E6E8E3] bg-[#F7F8F5] p-3.5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#6B9AC4]" />
                    <span className="text-xs font-semibold text-[#1A2E26]">
                      {sectionTitle}
                    </span>
                    <span className="rounded bg-[#EAECE6] px-1.5 py-0.5 text-[10px] font-semibold text-[#5E6B64]">
                      {groupCards.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openNewTaskModal(sectionTitle)}
                    aria-label={`Add task to ${sectionTitle}`}
                    className="cursor-pointer rounded p-1 text-[#7C8680] transition-colors hover:bg-[#EBF0E2] hover:text-[#16382C]"
                  >
                    <Plus size={13} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
                <div className="space-y-2.5">
                  {groupCards.map((card) => {
                    const done = isDoneColumn(card.column_name);
                    return (
                      <div
                        key={card.id}
                        className="rounded-lg border border-[#E6E8E3] bg-white px-3.5 py-3 text-xs transition-colors hover:border-[#C5CEBE]"
                      >
                        {card.labels && card.labels.length > 0 && (
                          <div className="mb-1.5 flex flex-wrap items-center gap-1">
                            {card.labels.map((label) => (
                              <span
                                key={label.id}
                                title={label.name}
                                aria-label={label.name}
                                className={`h-1.5 w-6 rounded-full ${
                                  LABEL_STRIP_STYLES[label.color] ?? "bg-[#CBD5E1]"
                                }`}
                              />
                            ))}
                          </div>
                        )}
                        <Link
                          href={`/boards/${card.board_id}?card=${card.id}`}
                          className={`block font-medium ${
                            done
                              ? "text-[#8B92A0] line-through"
                              : "text-[#1A2E26] hover:text-[#16382C]"
                          }`}
                        >
                          {card.title}
                        </Link>
                        <p className="mt-1 text-[11px] text-[#6E7A73]">
                          {card.board_name}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : taskView === "calendar" ? (
          <div className="mx-auto max-w-5xl rounded-xl border border-[#E6E8E3] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-lg italic text-[#162B22]">
                {calendarMonth.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setCalendarMonth(
                      (d) => new Date(d.getFullYear(), d.getMonth() - 1, 1),
                    )
                  }
                  aria-label="Previous month"
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-[#DCDFD8] text-[#1A2E26] transition-colors hover:bg-[#F3F4F0]"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                  }}
                  className="h-7 cursor-pointer rounded-lg border border-[#DCDFD8] px-2 text-[11px] font-medium text-[#1A2E26] transition-colors hover:bg-[#F3F4F0]"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCalendarMonth(
                      (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1),
                    )
                  }
                  aria-label="Next month"
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-[#DCDFD8] text-[#1A2E26] transition-colors hover:bg-[#F3F4F0]"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-[#E6E8E3] pb-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-[#6E7A73]">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div className="mt-1.5 grid grid-cols-7 gap-1">
              {calendarDays.map((cell, idx) => {
                const dayCards = cell.dateStr ? cardsByDate[cell.dateStr] ?? [] : [];
                const visibleDayCards = dayCards.slice(0, 2);
                const remainingCount = dayCards.length - visibleDayCards.length;

                return (
                  <div
                    key={idx}
                    className={`min-h-17 rounded-lg border p-1.5 ${
                      cell.dayNumber
                        ? "border-[#ECEEE9] bg-[#FAFBF9]"
                        : "border-transparent bg-transparent"
                    }`}
                  >
                    {cell.dayNumber && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-[#4E6356]">
                            {cell.dayNumber}
                          </span>
                          {dayCards.length > 0 && (
                            <span className="text-[9px] font-medium text-[#7C8680]">
                              {dayCards.length}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 space-y-0.5">
                          {visibleDayCards.map((c) => (
                            <Link
                              key={c.id}
                              href={`/boards/${c.board_id}?card=${c.id}`}
                              className="block w-full cursor-pointer truncate rounded bg-[#DCE5CC] px-1.5 py-0.5 text-left text-[10px] font-medium text-[#162B22] transition-colors hover:bg-[#CFDAB9]"
                            >
                              {c.title}
                            </Link>
                          ))}
                          {remainingCount > 0 && (
                            <p className="px-1 text-[9px] font-medium text-[#6E7A73]">
                              +{remainingCount} more
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#E6E8E3] bg-white">
            <div className="min-w-[680px]">
              {/* Column Header */}
              <div className="grid grid-cols-[minmax(0,2.5fr)_minmax(0,1.25fr)_120px_115px_125px_44px] items-center border-b border-[#ECEEE9] px-5 py-3 text-[11px] font-medium text-[#7C8680]">
                <span className="pl-7">Task name</span>
                <span>Board</span>
                <span>Status</span>
                <span>Priority</span>
                <span>Due date</span>
                <span className="sr-only">Actions</span>
              </div>

              {groupedSections.length === 0 || filteredAndSorted.length === 0 ? (
                <div className="px-5 py-12 text-center text-xs text-[#6E7A73]">
                  No tasks found matching your criteria.
                </div>
              ) : (
                groupedSections.map(([sectionTitle, groupCards]) => {
                  const sectionBadgeStyle =
                    STATUS_BADGE_STYLES[sectionTitle.toLowerCase()] ??
                    "bg-[#EAECE6] text-[#4E6356]";

                  return (
                    <div key={sectionTitle} className="border-b border-[#F1F2EE] last:border-b-0">
                      {/* Group Header Row */}
                      <div className="flex items-center justify-between border-b border-[#F2F3EF] bg-[#FAFBF8] px-5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-semibold text-[#1A2E26]">
                            {sectionTitle}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${sectionBadgeStyle}`}
                          >
                            {groupCards.length}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => openNewTaskModal(sectionTitle)}
                          aria-label={`Add task to ${sectionTitle}`}
                          className="cursor-pointer rounded p-1 text-[#7C8680] transition-colors hover:bg-[#EBF0E2] hover:text-[#16382C]"
                        >
                          <Plus size={14} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      </div>

                      {/* Group Task Rows */}
                      {groupCards.map((card) => {
                        const done = isDoneColumn(card.column_name);
                        const statusStyle =
                          STATUS_BADGE_STYLES[card.column_name.toLowerCase()] ??
                          "bg-[#EAECE6] text-[#4E6356] border-transparent";
                        const prioKey = (card.priority ?? "").toLowerCase();
                        const prioMeta =
                          prioKey === "high" || prioKey === "medium" || prioKey === "low"
                            ? PRIORITY_META[prioKey]
                            : null;

                        return (
                          <div
                            key={card.id}
                            className="grid grid-cols-[minmax(0,2.5fr)_minmax(0,1.25fr)_120px_115px_125px_44px] items-center border-b border-[#F5F6F3] px-5 py-3 text-xs transition-colors last:border-b-0 hover:bg-[#FAFBF9]"
                          >
                            <div className="flex min-w-0 items-center gap-2.5 pr-3">
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={done}
                                aria-label={`Mark ${card.title} as ${done ? "incomplete" : "complete"}`}
                                onClick={() => handleToggleComplete(card.id)}
                                className={`flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors ${
                                  done
                                    ? "border-[#143D2C] bg-[#143D2C] text-white"
                                    : "border-[#D0D5CD] bg-white hover:border-[#143D2C]"
                                }`}
                              >
                                {done && <Check size={11} strokeWidth={2.5} aria-hidden="true" />}
                              </button>

                              <Link
                                href={`/boards/${card.board_id}?card=${card.id}`}
                                className={`truncate font-medium transition-colors ${
                                  done
                                    ? "text-[#8C9590] line-through"
                                    : "text-[#1A2E26] hover:text-[#16382C]"
                                }`}
                              >
                                {card.title}
                              </Link>

                              {card.labels && card.labels.length > 0 && (
                                <div className="flex shrink-0 items-center gap-1">
                                  {card.labels.map((label) => (
                                    <span
                                      key={label.id}
                                      title={label.name}
                                      aria-label={label.name}
                                      className={`h-1.5 w-6 rounded-full ${
                                        LABEL_STRIP_STYLES[label.color] ?? "bg-[#CBD5E1]"
                                      }`}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="truncate pr-2 text-xs text-[#6E7A73]">
                              <Link
                                href={`/boards/${card.board_id}`}
                                className="hover:text-[#16382C] hover:underline"
                              >
                                {card.board_name}
                              </Link>
                            </div>

                            <div>
                              <BaseBadge className={statusStyle}>
                                {card.column_name}
                              </BaseBadge>
                            </div>

                            <div>
                              {prioMeta && !done ? (
                                <span
                                  className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${prioMeta.textClass}`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full ${prioMeta.dotClass}`} />
                                  <span>{prioMeta.label}</span>
                                </span>
                              ) : (
                                <span className="text-xs text-[#9AA3B2]">—</span>
                              )}
                            </div>

                            <div className="text-xs text-[#6E7A73]">
                              {done ? (
                                <span className="font-medium text-[#2E7D5B]">
                                  Completed
                                </span>
                              ) : (
                                formatMonthDay(card.due_date)
                              )}
                            </div>

                            <div className="flex justify-end">
                              <ActionMenu
                                label={`Actions for ${card.title}`}
                                symbolNode={
                                  <MoreHorizontal size={14} strokeWidth={1.75} aria-hidden="true" />
                                }
                                triggerClassName="h-7 w-7 cursor-pointer border-0 bg-transparent text-[#7C8680] hover:bg-[#EBF0E2] hover:text-[#16382C]"
                                items={[
                                  {
                                    id: "open-board",
                                    label: "Open in board",
                                    onSelect: () =>
                                      router.push(`/boards/${card.board_id}?card=${card.id}`),
                                  },
                                  {
                                    id: "toggle-done",
                                    label: done ? "Mark as incomplete" : "Mark as complete",
                                    onSelect: () => handleToggleComplete(card.id),
                                  },
                                ]}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {moreError && (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
            <p role="alert" className="text-xs text-destructive">
              {moreError}
            </p>
          </div>
        )}

        {hasMore && (
          <div className="mt-4 flex justify-center">
            <BaseButton
              variant="secondary"
              disabled={isLoadingMore}
              onClick={() => void handleLoadMore()}
              className="min-w-[140px]"
            >
              {isLoadingMore ? "Loading…" : "Load more"}
            </BaseButton>
          </div>
        )}
      </div>

      {/* Modal: Create New Task */}
      {isNewTaskOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="my-tasks-new-task-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isCreatingTask) {
              setIsNewTaskOpen(false);
              setNewTaskError(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-[#DCDFD8] bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2
                id="my-tasks-new-task-title"
                className="text-sm font-semibold text-[#1A2E26]"
              >
                New task
              </h2>
              <button
                type="button"
                disabled={isCreatingTask}
                onClick={() => {
                  setIsNewTaskOpen(false);
                  setNewTaskError(null);
                }}
                aria-label="Close new task modal"
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#6E7A73] transition-colors hover:bg-[#F3F4F0] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateNewTask} noValidate className="flex flex-col gap-3">
              <div>
                <label
                  htmlFor="my-task-title"
                  className="mb-1.5 block text-xs font-medium text-[#3F5347]"
                >
                  Task name
                </label>
                <input
                  ref={newTaskTitleRef}
                  id="my-task-title"
                  type="text"
                  value={newTaskTitle}
                  disabled={isCreatingTask}
                  placeholder="Enter task name..."
                  onChange={(e) => {
                    setNewTaskTitle(e.target.value);
                    if (newTaskError) setNewTaskError(null);
                  }}
                  className="h-9 w-full rounded-lg border border-[#DCDFD8] bg-[#FAF9F6] px-3 text-xs text-[#1A2E26] focus:border-[#16382C] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="my-task-target"
                  className="mb-1.5 block text-xs font-medium text-[#3F5347]"
                >
                  Board &amp; Column
                </label>
                <select
                  id="my-task-target"
                  value={selectedTargetKey}
                  disabled={isCreatingTask || loadingTargets || boardTargets.length === 0}
                  onChange={(e) => setSelectedTargetKey(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[#DCDFD8] bg-[#FAF9F6] px-3 text-xs text-[#1A2E26] focus:border-[#16382C] focus:bg-white focus:outline-none"
                >
                  {boardTargets.length === 0 ? (
                    <option value="">
                      {loadingTargets ? "Loading boards..." : "No board columns available"}
                    </option>
                  ) : (
                    boardTargets.map((t) => {
                      const key = `${t.boardId}::${t.columnId}`;
                      return (
                        <option key={key} value={key}>
                          {t.boardName} — {t.columnName}
                        </option>
                      );
                    })
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="my-task-priority"
                    className="mb-1.5 block text-xs font-medium text-[#3F5347]"
                  >
                    Priority
                  </label>
                  <select
                    id="my-task-priority"
                    value={newTaskPriority}
                    disabled={isCreatingTask}
                    onChange={(e) =>
                      setNewTaskPriority(e.target.value as CardPriority)
                    }
                    className="h-9 w-full rounded-lg border border-[#DCDFD8] bg-[#FAF9F6] px-3 text-xs text-[#1A2E26] focus:border-[#16382C] focus:bg-white focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="my-task-due"
                    className="mb-1.5 block text-xs font-medium text-[#3F5347]"
                  >
                    Due date
                  </label>
                  <input
                    id="my-task-due"
                    type="date"
                    value={newTaskDueDate}
                    disabled={isCreatingTask}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[#DCDFD8] bg-[#FAF9F6] px-3 text-xs text-[#1A2E26] focus:border-[#16382C] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {newTaskError && (
                <p role="alert" className="text-xs text-destructive">
                  {newTaskError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <BaseButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isCreatingTask}
                  onClick={() => {
                    setIsNewTaskOpen(false);
                    setNewTaskError(null);
                  }}
                  className="cursor-pointer"
                >
                  Cancel
                </BaseButton>
                <BaseButton
                  type="submit"
                  size="sm"
                  disabled={isCreatingTask}
                  className="cursor-pointer"
                >
                  {isCreatingTask ? "Creating…" : "Create task"}
                </BaseButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}