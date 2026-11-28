"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useNow } from "@/hooks/useNow";
import { useDragAndDrop, type ColumnCardMap } from "@/hooks/useDragAndDrop";
import { useBoardFilters } from "@/hooks/useBoardFilters";
import { useFilterShortcut } from "@/hooks/useFilterShortcut";
import { filterColumns } from "@/lib/filterCards";
import { sortColumns, type SortBy } from "@/lib/sortCards";
import { groupByPriority, type GroupBy } from "@/lib/groupCards";
import { getBoard, listBoards } from "@/lib/services/boardsService";
import {
  createColumn,
  deleteColumn,
  renameColumn,
  updateColumn,
  reorderColumns,
} from "@/lib/services/columnsService";
import { createCard, deleteCard, setCardLabels } from "@/lib/services/cardsService";
import { createLabel } from "@/lib/services/labelsService";
import {
  inviteMember,
  listMembers,
  removeMember,
} from "@/lib/services/membersService";
import { exportBoard, validateImport, type ExportedColumn } from "@/lib/boardImportExport";
import { ApiError } from "@/lib/errors";
import { loginPath } from "@/lib/loginPath";
import { moveItem } from "@/lib/columnOrder";
import { showError, showSuccess, showLoading, dismissToast } from "@/lib/toast";
import type {
  BoardMember,
  BoardRole,
  Card,
  CardPriority,
  ColumnColor,
  ColumnWithCards,
  Label,
  LabelColor,
} from "@/lib/types/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { BaseButton } from "@/components/shared/BaseButton";
import { BoardColumn } from "@/components/board/BoardColumn";
import { BoardListView } from "@/components/board/BoardListView";
import { CardDetailModal } from "@/components/board/CardDetailModal";
import { ActionMenu } from "@/components/shared/ActionMenu";
import {
  ArrowUpDown,
  Calendar as CalendarIcon,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Kanban,
  List,
  Lock,
  MoreHorizontal,
  Plus,
  Search,
  Star,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";

type BoardView = "kanban" | "list" | "calendar";

type ViewState =
  | { status: "idle" }
  | {
      status: "success";
      boardName: string;
      boardCode: string;
      isFavorite: boolean;
      columns: ColumnWithCards[];
      labels: Label[];
      role: BoardRole;
      members: BoardMember[];
    }
  | { status: "error"; message: string };

interface QuickSearchTaskItem {
  card: Card;
  columnName: string;
}

interface FloatingColumnDrag {
  column: ColumnWithCards;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
}

interface ShareBoardDialogProps {
  boardId: string;
  boardName: string;
  shareUrl: string;
  token: string;
  initialMembers: BoardMember[];
  canManage: boolean;
  onClose: () => void;
  onMembersSynced: (members: BoardMember[]) => void;
}

const NO_LABELS: Label[] = [];

const DEFAULT_BOARD_DESCRIPTION =
  "Big ideas, small steps. A space to move our work forward.";

/** Distinct dataTransfer type so column drags are never mistaken for card drags. */
const COLUMN_DRAG_TYPE = "application/x-revotask-column";

const COLUMN_COLORS: readonly ColumnColor[] = [
  "gray",
  "blue",
  "orange",
  "green",
  "red",
];

const LABEL_COLORS: readonly LabelColor[] = [
  "blue",
  "sky",
  "graphite",
  "silver",
  "red",
  "orange",
  "green",
  "purple",
];

const PRIORITIES: readonly CardPriority[] = ["low", "medium", "high"];

function toColumnColor(value: unknown): ColumnColor | undefined {
  return COLUMN_COLORS.find((c) => c === value);
}

function toLabelColor(value: unknown): LabelColor {
  return LABEL_COLORS.find((c) => c === value) ?? "graphite";
}

function toPriority(value: unknown): CardPriority | undefined {
  return PRIORITIES.find((p) => p === value);
}

function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function formatBoardIndexCode(indexOneBased: number): string {
  return String(Math.max(1, indexOneBased)).padStart(3, "0");
}

function ShareBoardDialog({
  boardId,
  boardName,
  shareUrl,
  token,
  initialMembers,
  canManage,
  onClose,
  onMembersSynced,
}: ShareBoardDialogProps) {
  const [members, setMembers] = useState<BoardMember[]>(initialMembers);
  const [email, setEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refreshMembers = useCallback(async () => {
    try {
      const latest = await listMembers(token, boardId);
      setMembers(latest);
      onMembersSynced(latest);
    } catch {
      // Keep current list if refresh fails
    }
  }, [token, boardId, onMembersSynced]);

  useEffect(() => {
    void refreshMembers();
  }, [refreshMembers]);

  async function handleCopy() {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setStatus("Board link copied.");
      showSuccess("Board link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy board link.");
    }
  }

  async function handleInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Please enter an email address.");
      return;
    }
    setIsInviting(true);
    setError(null);
    setStatus(null);
    try {
      await inviteMember(token, boardId, trimmed);
      setEmail("");
      setStatus(`Invited ${trimmed}.`);
      showSuccess("Member added");
      await refreshMembers();
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Could not invite member.",
      );
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRemove(userId: string) {
    setRemovingUserId(userId);
    setError(null);
    setStatus(null);
    try {
      await removeMember(token, boardId, userId);
      const next = members.filter((m) => m.user_id !== userId);
      setMembers(next);
      setStatus("Member removed.");
      onMembersSynced(next);
      await refreshMembers();
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Could not remove member.",
      );
    } finally {
      setRemovingUserId(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-board-popup-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#162B22]/45 p-3 sm:p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#D5DDD0] bg-[#FAF9F6] text-[#1A2E26] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[#DCE5CC] bg-[#EBF0E2] px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="min-w-0 pr-2">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4E6356]">
              {boardName}
            </p>
            <h2
              id="share-board-popup-title"
              className="font-serif text-lg italic text-[#162B22]"
            >
              Share board
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#4E6356] transition-colors hover:bg-[#DCE5CC] hover:text-[#162B22] sm:h-7 sm:w-7"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-4 sm:p-5">
          {/* Copy link */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[#D5DDD0] bg-[#F4F6EE] px-3 py-2">
            <span className="truncate text-xs text-[#4E6356]">{shareUrl}</span>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[#C9D3C2] bg-white px-2.5 py-1.5 text-xs font-medium text-[#16382C] transition-colors hover:bg-[#EBF0E2] sm:py-1"
            >
              {copied ? (
                <>
                  <Check size={13} aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={13} aria-hidden="true" />
                  <span>Copy link</span>
                </>
              )}
            </button>
          </div>

          {/* Invite member form */}
          {canManage && (
            <form onSubmit={handleInvite} noValidate className="flex flex-col gap-2">
              <label
                htmlFor="share-member-email"
                className="text-xs font-medium text-[#173B30]"
              >
                Invite member by email
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="share-member-email"
                  type="email"
                  value={email}
                  disabled={isInviting}
                  placeholder="member@example.com"
                  onKeyDown={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                    if (status) setStatus(null);
                  }}
                  className="h-10 flex-1 rounded-lg border border-[#D5DDD0] bg-[#F4F6EE] px-3 text-base text-[#173B30] placeholder:text-[#7B8B81] focus:border-[#16382C] focus:bg-white focus:outline-none disabled:opacity-50 sm:h-9 sm:text-xs"
                />
                <BaseButton
                  type="submit"
                  size="sm"
                  disabled={isInviting}
                  className="h-10 justify-center sm:h-9"
                >
                  <UserPlus size={14} aria-hidden="true" />
                  <span>{isInviting ? "Inviting…" : "Invite"}</span>
                </BaseButton>
              </div>
            </form>
          )}

          {error && (
            <p role="alert" className="text-xs text-[#B34F48]">
              {error}
            </p>
          )}
          {status && (
            <p role="status" aria-live="polite" className="text-xs text-[#4E6356]">
              {status}
            </p>
          )}

          {/* Members list */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#4E6356]">
              Members ({members.length})
            </span>
            <ul className="flex max-h-52 flex-col gap-2 overflow-y-auto">
              {members.map((m) => {
                const isOwnerMember = m.role === "owner";
                const busy = removingUserId === m.user_id;
                return (
                  <li
                    key={m.user_id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#DCE4D7] bg-[#F4F6EE]/70 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[#173B30]">
                        {m.name ?? m.email}
                      </p>
                      {m.name && (
                        <p className="truncate text-[11px] text-[#6F7F75]">
                          {m.email}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-md border border-[#D5DDD0] bg-[#EBF0E2] px-2 py-0.5 text-[11px] font-medium capitalize text-[#173B30]">
                        {m.role}
                      </span>
                      {canManage && !isOwnerMember && (
                        <button
                          type="button"
                          disabled={busy}
                          aria-label={`Remove ${m.name ?? m.email}`}
                          onClick={() => void handleRemove(m.user_id)}
                          className="cursor-pointer rounded-lg p-1.5 text-[#6F7F75] transition-colors hover:bg-[#FDECEC] hover:text-[#B34F48] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="flex shrink-0 justify-end border-t border-[#E6E8E3] bg-[#FAF9F6] px-4 py-3 sm:px-5 sm:py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-[#EBF0E2] px-4 text-xs font-medium text-[#16382C] transition-colors hover:bg-[#DCE5CC] sm:h-8.5 sm:px-3.5"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

interface BoardDetailViewProps {
  boardId: string;
}

export function BoardDetailView({ boardId }: BoardDetailViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handledCardRef = useRef<string | null>(null);
  const taskSearchInputRef = useRef<HTMLInputElement>(null);
  const taskSearchContainerRef = useRef<HTMLDivElement>(null);
  const newColumnInputRef = useRef<HTMLInputElement>(null);
  const emptyDragImgRef = useRef<HTMLCanvasElement | null>(null);
  const { token, isAuthLoading } = useRequireAuth();
  const now = useNow();

  const [state, setState] = useState<ViewState>({ status: "idle" });
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  // Quick search dropdown state
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [searchActiveIndex, setSearchActiveIndex] = useState(0);

  // Add column / task popup state
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [columnName, setColumnName] = useState("");
  const [columnError, setColumnError] = useState<string | null>(null);
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);

  // Drag & focus refs
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  const [floatingDrag, setFloatingDrag] = useState<FloatingColumnDrag | null>(null);
  const [addCardTargetColumnId, setAddCardTargetColumnId] = useState<string | null>(null);
  const draggedColumnRef = useRef<string | null>(null);
  const focusColumnRef = useRef<string | null>(null);
  const isReorderingRef = useRef(false);

  // Toolbar & modal states
  const [sortBy, setSortBy] = useState<SortBy>("manual");
  const [boardView, setBoardView] = useState<BoardView>("kanban");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const importInputRef = useRef<HTMLInputElement>(null);
  const isImportingRef = useRef(false);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    emptyDragImgRef.current = canvas;
  }, []);

  // Track pointer position smoothly while dragging a column
  useEffect(() => {
    if (!draggingColumnId) return;

    const handleDocumentDragOver = (e: DragEvent) => {
      if (e.clientX <= 0 && e.clientY <= 0) return;
      setFloatingDrag((prev) =>
        prev ? { ...prev, x: e.clientX, y: e.clientY } : null,
      );
    };

    const handleDocumentDragEnd = () => {
      draggedColumnRef.current = null;
      setDraggingColumnId(null);
      setFloatingDrag(null);
    };

    document.addEventListener("dragover", handleDocumentDragOver);
    document.addEventListener("dragend", handleDocumentDragEnd);
    return () => {
      document.removeEventListener("dragover", handleDocumentDragOver);
      document.removeEventListener("dragend", handleDocumentDragEnd);
    };
  }, [draggingColumnId]);

  const closeNewColumnPopup = useCallback(() => {
    if (isCreatingColumn) return;
    setIsAddingColumn(false);
    setColumnName("");
    setColumnError(null);
  }, [isCreatingColumn]);

  useEffect(() => {
    if (!isAddingColumn) return;
    requestAnimationFrame(() => {
      newColumnInputRef.current?.focus();
    });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeNewColumnPopup();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAddingColumn, closeNewColumnPopup]);

  const handleLoadError = useCallback(
    (err: unknown): ViewState | null => {
      if (err instanceof ApiError && err.isUnauthorized) {
        router.replace(loginPath(pathname));
        return null;
      }
      let message = "Could not load this board. Please try again.";
      if (err instanceof ApiError) {
        message = err.isNotFound ? "Board not found." : err.message;
      }
      return { status: "error", message };
    },
    [router, pathname],
  );

  const handleActionError = useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof ApiError) {
        if (err.isUnauthorized) return router.replace(loginPath(pathname));
        if (err.isForbidden) return showError("You don't have permission to do that.");
        if (!err.isServerError) return showError(err.message);
      }
      showError(fallback);
    },
    [router, pathname],
  );

  useEffect(() => {
    if (isAuthLoading || !token) return;
    let cancelled = false;
    Promise.all([getBoard(token, boardId), listBoards(token).catch(() => null)])
      .then(([board, allBoards]) => {
        if (cancelled) return;
        const sortedByCreation = Array.isArray(allBoards)
          ? [...allBoards].sort(
              (a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            )
          : [];
        const matchedIndex = sortedByCreation.findIndex((b) => b.id === board.id);
        const resolvedBoardCode = formatBoardIndexCode(
          matchedIndex >= 0 ? matchedIndex + 1 : sortedByCreation.length + 1,
        );

        setState({
          status: "success",
          boardName: board.name,
          boardCode: resolvedBoardCode,
          isFavorite: board.is_favorite,
          columns: [...board.columns].sort((a, b) => a.position - b.position),
          labels: board.labels ?? [],
          role: board.role ?? board.access?.role ?? "member",
          members: board.members ?? [],
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const next = handleLoadError(err);
        if (!next) return;
        const lostAccess = err instanceof ApiError && (err.isForbidden || err.isNotFound);
        setState((prev) => (prev.status === "success" && !lostAccess ? prev : next));
        if (reloadKey > 0 && !lostAccess) showError("Could not refresh the board.");
      });
    return () => {
      cancelled = true;
    };
  }, [token, isAuthLoading, boardId, reloadKey, handleLoadError]);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  const handleMembersSynced = useCallback(
    (nextMembers: BoardMember[]) => {
      setState((prev) =>
        prev.status === "success" ? { ...prev, members: nextMembers } : prev,
      );
      refetch();
    },
    [refetch],
  );

  const columnsForFocus = state.status === "success" ? state.columns : null;
  useEffect(() => {
    const id = focusColumnRef.current;
    if (!id) return;
    focusColumnRef.current = null;
    document.querySelector<HTMLElement>(`[data-column-handle="${id}"]`)?.focus();
  }, [columnsForFocus]);

  const columns = state.status === "success" ? state.columns : null;

  const cardParam = searchParams.get("card");
  useEffect(() => {
    if (!cardParam) {
      handledCardRef.current = null;
      return;
    }
    if (!columns || handledCardRef.current === cardParam) return;
    handledCardRef.current = cardParam;

    const exists = columns.some((c) => c.cards.some((x) => x.id === cardParam));
    if (exists) setSelectedCardId(cardParam);
    else showError("That task could not be found on this board.");

    const next = new URLSearchParams(searchParams.toString());
    next.delete("card");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [cardParam, columns, searchParams, router, pathname]);

  const columnMap: ColumnCardMap = useMemo(() => {
    const map: ColumnCardMap = {};
    for (const col of columns ?? []) {
      map[col.id] = [...col.cards].sort((a, b) => a.order - b.order);
    }
    return map;
  }, [columns]);

  const setColumnMap = useCallback((map: ColumnCardMap) => {
    setState((prev) =>
      prev.status === "success"
        ? {
            ...prev,
            columns: prev.columns.map((col) => ({
              ...col,
              cards: map[col.id] ?? col.cards,
            })),
          }
        : prev,
    );
  }, []);

  // ----- Filters (client-side, URL-backed) -----
  const loadedLabels = state.status === "success" ? state.labels : NO_LABELS;
  const validLabelIds = useMemo(() => loadedLabels.map((l) => l.id), [loadedLabels]);
  const {
    filters,
    debouncedKeyword,
    activeCount,
    setKeyword,
  } = useBoardFilters(validLabelIds);

  useFilterShortcut(
    useCallback(() => {
      taskSearchInputRef.current?.focus();
      setSearchDropdownOpen(true);
    }, []),
  );

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!taskSearchContainerRef.current?.contains(e.target as Node)) {
        setSearchDropdownOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const effectiveFilters = useMemo(
    () => ({
      ...filters,
      keyword: filters.keyword || debouncedKeyword,
    }),
    [filters, debouncedKeyword],
  );

  const filteredColumns = useMemo(
    () => filterColumns(columns ?? [], effectiveFilters, now),
    [columns, effectiveFilters, now],
  );
  const sortedColumns = useMemo(
    () => sortColumns(filteredColumns, sortBy),
    [filteredColumns, sortBy],
  );
  const priorityGroups = useMemo(
    () => (groupBy === "priority" ? groupByPriority(sortedColumns) : null),
    [groupBy, sortedColumns],
  );

  const quickSearchItems = useMemo<QuickSearchTaskItem[]>(() => {
    const term = filters.keyword.trim().toLowerCase();
    if (!term || !columns) return [];
    const matches: QuickSearchTaskItem[] = [];
    for (const col of columns) {
      for (const card of col.cards) {
        const titleMatch = card.title.toLowerCase().includes(term);
        const descMatch = (card.description ?? "").toLowerCase().includes(term);
        const labelMatch = (card.labels ?? []).some((l) =>
          l.name.toLowerCase().includes(term),
        );
        if (titleMatch || descMatch || labelMatch) {
          matches.push({ card, columnName: col.name });
          if (matches.length >= 8) return matches;
        }
      }
    }
    return matches;
  }, [columns, filters.keyword]);

  const showQuickSearchPanel =
    searchDropdownOpen && filters.keyword.trim().length > 0;
  const clampedSearchIndex = Math.min(
    searchActiveIndex,
    Math.max(quickSearchItems.length - 1, 0),
  );

  // ----- Calendar View Helpers (above early returns to satisfy Rules of Hooks) -----
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
    const map: Record<string, Array<Card & { columnName: string }>> = {};
    for (const col of sortedColumns) {
      for (const card of col.cards) {
        if (!card.due_date) continue;
        const key = toLocalDateKey(card.due_date);
        if (!map[key]) map[key] = [];
        map[key].push({ ...card, columnName: col.name });
      }
    }
    return map;
  }, [sortedColumns]);

  const { dragHandlers, draggingCardId } = useDragAndDrop({
    columns: columnMap,
    onColumnsChange: (map) => {
      setMoveError(null);
      setColumnMap(map);
    },
    onMoveSuccess: refetch,
    onMoveError: () =>
      setMoveError("Could not move the card. It was put back where it was."),
  });

  // ----- Loading Skeleton -----
  if (isAuthLoading || !token || state.status === "idle") {
    return (
      <div className="flex min-w-0 flex-1 flex-col bg-[#FAF9F6]" aria-busy="true" aria-label="Loading board">
        <PageHeader parent={{ label: "Boards", href: "/" }} />
        <div className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6">
          <div className="h-36 animate-pulse rounded-2xl bg-[#DCE5CC]/70 sm:h-40" />
          <div className="h-10 w-64 max-w-full animate-pulse rounded-lg bg-[#EAECE6] sm:w-72" />
          <div className="flex gap-4 overflow-x-auto sm:gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-96 w-72 shrink-0 animate-pulse rounded-2xl bg-[#EAECE6]/80"
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ----- Error State -----
  if (state.status === "error") {
    return (
      <div className="flex min-w-0 flex-1 flex-col bg-[#FAF9F6]">
        <PageHeader parent={{ label: "Boards", href: "/" }} />
        <div className="px-4 py-6 sm:px-6 sm:py-8">
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {state.message}
          </div>
        </div>
      </div>
    );
  }

  const {
    boardName,
    boardCode,
    isFavorite,
    columns: boardColumns,
    labels: boardLabels,
    role,
    members,
  } = state;

  const canManageMembers = role === "owner";

  // Workspace owner label
  const ownerMember = members.find((m) => m.role === "owner") ?? members[0];
  const ownerName = ownerMember?.name?.trim() || "Owner";
  const workspaceLabel = `${ownerName}'s workspace`;

  // Progress calculation
  const totalCards = boardColumns.reduce((sum, c) => sum + c.cards.length, 0);
  const completedCards = boardColumns
    .filter((c) => c.is_done || c.name.trim().toLowerCase() === "done")
    .reduce((sum, c) => sum + c.cards.length, 0);
  const completionPct =
    totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;

  const labelUsage: Record<string, number> = {};
  for (const col of boardColumns) {
    for (const c of col.cards) {
      if (!c.labels) continue;
      for (const l of c.labels) labelUsage[l.id] = (labelUsage[l.id] ?? 0) + 1;
    }
  }

  const isFiltering = activeCount > 0 || sortBy !== "manual";
  const visibleCards = filteredColumns.reduce((sum, c) => sum + c.cards.length, 0);
  const noCardMatches = activeCount > 0 && totalCards > 0 && visibleCards === 0;
  const selectedCard: Card | undefined = boardColumns
    .flatMap((c) => c.cards)
    .find((c) => c.id === selectedCardId);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/boards/${boardId}`
      : `/boards/${boardId}`;

  async function guard<T>(request: Promise<T>): Promise<T> {
    try {
      return await request;
    } catch (err) {
      if (err instanceof ApiError && err.isUnauthorized) {
        router.replace(loginPath(pathname));
      }
      throw err;
    }
  }

  function handleToggleFavorite() {
    setState((prev) =>
      prev.status === "success" ? { ...prev, isFavorite: !prev.isFavorite } : prev,
    );
  }

  function handleOpenQuickTask(cardId: string) {
    setSearchDropdownOpen(false);
    setSearchActiveIndex(0);
    setSelectedCardId(cardId);
  }

  // ----- Export handler -----
  function handleExport() {
    if (state.status !== "success") return;
    const json = exportBoard({
      id: boardId,
      name: boardName,
      user_id: ownerMember?.user_id ?? "",
      is_favorite: isFavorite,
      created_at: "",
      updated_at: "",
      role,
      columns: boardColumns,
      labels: boardLabels,
      members,
    });
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${boardName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ----- Import helpers -----
  async function runBoardImport(file: File) {
    let parsed: unknown;
    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });
      parsed = JSON.parse(text);
    } catch {
      showError("Invalid file: could not parse JSON.");
      return;
    }

    const result = validateImport(parsed);
    if (!result.valid) {
      showError(result.error);
      return;
    }

    const { data } = result;
    const toastId = showLoading("Importing…");
    const failures: string[] = [];
    const labelCache: Label[] = state.status === "success" ? [...state.labels] : [];

    try {
      for (const col of data.board.columns as ExportedColumn[]) {
        let newColId: string;
        try {
          const created = await createColumn(token as string, boardId, col.name);
          newColId = created.id;
        } catch (err) {
          if (err instanceof ApiError && (err.isUnauthorized || err.isForbidden)) throw err;
          failures.push(`Column "${col.name}": failed to create.`);
          continue;
        }

        if (col.color || col.is_done) {
          try {
            await updateColumn(token as string, newColId, {
              color: toColumnColor(col.color),
              is_done: col.is_done ?? false,
            });
          } catch (err) {
            if (err instanceof ApiError && (err.isUnauthorized || err.isForbidden)) throw err;
            failures.push(`Column "${col.name}": color/done status not applied.`);
          }
        }

        const colCards = col.cards ?? [];
        for (const cardData of colCards) {
          let createdCardId: string;
          try {
            const createdCard = await createCard(token as string, newColId, {
              title: cardData.title,
              description: cardData.description ?? undefined,
              priority: toPriority(cardData.priority),
              due_date: cardData.due_date ?? undefined,
            });
            createdCardId = createdCard.id;
          } catch (err) {
            if (err instanceof ApiError && (err.isUnauthorized || err.isForbidden)) throw err;
            failures.push(`Card "${cardData.title}" in column "${col.name}": failed to create.`);
            continue;
          }

          if (cardData.labels && cardData.labels.length > 0) {
            try {
              const labelIds: string[] = [];
              for (const importLabel of cardData.labels) {
                const existing = labelCache.find(
                  (l) => l.name.toLowerCase() === importLabel.name.toLowerCase(),
                );
                if (existing) {
                  labelIds.push(existing.id);
                } else {
                  try {
                    const created = await createLabel(token as string, boardId, {
                      name: importLabel.name,
                      color: toLabelColor(importLabel.color),
                    });
                    labelCache.push(created);
                    labelIds.push(created.id);
                  } catch (err) {
                    if (err instanceof ApiError && (err.isUnauthorized || err.isForbidden)) {
                      throw err;
                    }
                    failures.push(
                      `Label "${importLabel.name}" for card "${cardData.title}": could not create.`,
                    );
                  }
                }
              }
              if (labelIds.length > 0) {
                await setCardLabels(token as string, createdCardId, labelIds);
              }
            } catch (err) {
              if (err instanceof ApiError && (err.isUnauthorized || err.isForbidden)) throw err;
              failures.push(`Labels for card "${cardData.title}": failed to apply.`);
            }
          }
        }
      }
    } finally {
      dismissToast(toastId);
    }

    refetch();

    if (failures.length === 0) {
      showSuccess("Import complete.");
    } else {
      showError(
        `Import finished with issues:\n${failures.slice(0, 5).join("\n")}${
          failures.length > 5 ? `\n… and ${failures.length - 5} more` : ""
        }`,
      );
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || isImportingRef.current) return;

    isImportingRef.current = true;
    try {
      await runBoardImport(file);
    } catch (err) {
      handleActionError(err, "Import failed.");
      refetch();
    } finally {
      isImportingRef.current = false;
    }
  }

  function updateColumns(fn: (cols: ColumnWithCards[]) => ColumnWithCards[]) {
    setState((prev) =>
      prev.status === "success" ? { ...prev, columns: fn(prev.columns) } : prev,
    );
  }

  function handleOpenNewColumn() {
    setColumnError(null);
    setColumnName("");
    setIsAddingColumn(true);
  }

  async function handleCreateColumn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = columnName.trim();
    if (!name) {
      setColumnError("Task name is required.");
      return;
    }
    setIsCreatingColumn(true);
    setColumnError(null);
    try {
      const created = await guard(createColumn(token as string, boardId, name));
      updateColumns((cols) => [...cols, { ...created, cards: [] }]);
      setColumnName("");
      setIsAddingColumn(false);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.isUnauthorized) return;
      const fieldError = err instanceof ApiError ? err.details?.name?.[0] : undefined;
      setColumnError(
        fieldError ?? (err instanceof Error ? err.message : "Could not add the task."),
      );
    } finally {
      setIsCreatingColumn(false);
    }
  }

  async function handleRename(columnId: string, name: string) {
    const updated = await guard(renameColumn(token as string, columnId, name));
    updateColumns((cols) =>
      cols.map((c) => (c.id === columnId ? { ...c, name: updated.name } : c)),
    );
  }

  async function handleUpdateColumn(
    columnId: string,
    patch: { color?: ColumnColor | null; is_done?: boolean },
  ) {
    const updated = await guard(updateColumn(token as string, columnId, patch));
    updateColumns((cols) =>
      cols.map((c) =>
        c.id === columnId ? { ...c, color: updated.color, is_done: updated.is_done } : c,
      ),
    );
  }

  async function handleToggleColumnDone(columnId: string) {
    const target = boardColumns.find((c) => c.id === columnId);
    if (!target) return;
    const nextDone = !target.is_done;
    try {
      await handleUpdateColumn(columnId, { is_done: nextDone });
      showSuccess(nextDone ? "Column marked as done." : "Column unmarked as done.");
    } catch (err) {
      handleActionError(err, "Could not update column done status.");
    }
  }

  async function handleDeleteColumn(columnId: string) {
    await guard(deleteColumn(token as string, columnId));
    updateColumns((cols) => cols.filter((c) => c.id !== columnId));
  }

  function orderColumns(ids: string[]) {
    updateColumns((cols) => [
      ...ids.flatMap((id, position) => {
        const col = cols.find((c) => c.id === id);
        return col ? [{ ...col, position }] : [];
      }),
      ...cols.filter((c) => !ids.includes(c.id)),
    ]);
  }

  async function reorderBoardColumns(orderedIds: string[]) {
    if (isReorderingRef.current) return;
    isReorderingRef.current = true;

    const previousIds = boardColumns.map((c) => c.id);
    orderColumns(orderedIds);
    try {
      await reorderColumns(token as string, boardId, orderedIds);
    } catch (err) {
      orderColumns(previousIds);
      handleActionError(err, "Could not reorder the columns. The previous order was restored.");
    } finally {
      isReorderingRef.current = false;
    }
  }

  function handleColumnDragStart(e: React.DragEvent<HTMLElement>, columnId: string) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(COLUMN_DRAG_TYPE, columnId);
    if (emptyDragImgRef.current) {
      e.dataTransfer.setDragImage(emptyDragImgRef.current, 0, 0);
    }

    draggedColumnRef.current = columnId;
    setDraggingColumnId(columnId);

    const targetCol = boardColumns.find((c) => c.id === columnId);
    const colEl = e.currentTarget.closest<HTMLElement>("[data-column-id]") ?? e.currentTarget;
    const rect = colEl.getBoundingClientRect();

    if (targetCol) {
      const pointerX = e.clientX || rect.left + rect.width / 2;
      const pointerY = e.clientY || rect.top + 24;
      setFloatingDrag({
        column: targetCol,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        offsetX: Math.max(0, Math.min(rect.width, pointerX - rect.left)),
        offsetY: Math.max(0, Math.min(rect.height, pointerY - rect.top)),
        x: pointerX,
        y: pointerY,
      });
    }
  }

  function handleColumnDragEnd() {
    draggedColumnRef.current = null;
    setDraggingColumnId(null);
    setFloatingDrag(null);
  }

  function handleColumnDragOver(e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (e.clientX > 0 || e.clientY > 0) {
      setFloatingDrag((prev) =>
        prev ? { ...prev, x: e.clientX, y: e.clientY } : null,
      );
    }
  }

  function handleColumnDrop(e: React.DragEvent<HTMLElement>, targetColumnId: string) {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = draggedColumnRef.current ?? e.dataTransfer.getData(COLUMN_DRAG_TYPE);
    handleColumnDragEnd();
    if (!draggedId || draggedId === targetColumnId) return;
    const ids = boardColumns.map((c) => c.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetColumnId);
    if (from < 0 || to < 0) return;
    void reorderBoardColumns(moveItem(ids, from, to));
  }

  function handleColumnMove(columnId: string, direction: -1 | 1) {
    const ids = boardColumns.map((c) => c.id);
    const from = ids.indexOf(columnId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    focusColumnRef.current = columnId;
    void reorderBoardColumns(moveItem(ids, from, to));
  }

  async function handleAddCard(columnId: string, title: string, position?: "top") {
    const created = await guard(
      createCard(
        token as string,
        columnId,
        position ? { title, position } : { title },
      ),
    );
    const cardWithDefaults: Card = {
      ...created,
      can_move: created.can_move ?? true,
    };
    updateColumns((cols) =>
      cols.map((c) => {
        if (c.id !== columnId) return c;
        const cards =
          position === "top" ? [cardWithDefaults, ...c.cards] : [...c.cards, cardWithDefaults];
        return { ...c, cards };
      }),
    );
    if (position === "top") refetch();
  }

  function handleCardUpdated(card: Card) {
    updateColumns((cols) =>
      cols.map((c) => ({
        ...c,
        cards: c.cards.map((x) => (x.id === card.id ? { ...x, ...card } : x)),
      })),
    );
  }

  function handleCardDeleted(cardId: string) {
    updateColumns((cols) =>
      cols.map((c) => ({ ...c, cards: c.cards.filter((x) => x.id !== cardId) })),
    );
    setSelectedCardId(null);
  }

  async function handleDuplicateCard(columnId: string, card: Card) {
    let created: Card;
    try {
      created = await createCard(token as string, columnId, {
        title: card.title,
        description: card.description ?? undefined,
        priority: card.priority ?? undefined,
        due_date: card.due_date ?? undefined,
      });
    } catch (err) {
      handleActionError(err, "Could not duplicate the card.");
      return;
    }

    const duplicatedCard: Card = {
      ...created,
      can_move: created.can_move ?? true,
    };
    updateColumns((cols) =>
      cols.map((c) => (c.id !== columnId ? c : { ...c, cards: [...c.cards, duplicatedCard] })),
    );
    if (card.labels && card.labels.length > 0) {
      try {
        const withLabels = await setCardLabels(
          token as string,
          created.id,
          card.labels.map((l) => l.id),
        );
        updateColumns((cols) =>
          cols.map((c) =>
            c.id !== columnId
              ? c
              : {
                  ...c,
                  cards: c.cards.map((x) =>
                    x.id === created.id ? { ...x, ...withLabels } : x,
                  ),
                },
          ),
        );
      } catch (err) {
        handleActionError(err, "Card duplicated, but labels could not be copied.");
        return;
      }
    }
    showSuccess("Task duplicated");
  }

  async function handleDeleteCard(columnId: string, card: Card) {
    await guard(deleteCard(token as string, card.id));
    handleCardDeleted(card.id);
  }

  return (
    <div className="flex min-h-full min-w-0 flex-1 flex-col bg-[#FAF9F6] text-[#1A2E26]">
      {/* Solid Floating Drag Overlay (opaque & never clipped by scroll/search bars) */}
      {floatingDrag && (
        <div
          aria-hidden="true"
          style={{
            width: `${floatingDrag.width}px`,
            minHeight: `${floatingDrag.height}px`,
            transform: `translate3d(${Math.round(floatingDrag.x - floatingDrag.offsetX)}px, ${Math.round(floatingDrag.y - floatingDrag.offsetY)}px, 0)`,
          }}
          className="pointer-events-none fixed top-0 left-0 z-50 rounded-2xl border border-[#B8C4B4] bg-[#F7F8F5] p-3.5 opacity-100 shadow-2xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#6B9AC4]" />
              <span className="text-xs font-semibold text-[#1A2E26]">
                {floatingDrag.column.name}
              </span>
              <span className="text-xs text-[#7A857E]">
                {floatingDrag.column.cards.length}
              </span>
            </div>
          </div>
          <div className="space-y-2.5">
            {floatingDrag.column.cards.map((card) => (
              <div
                key={card.id}
                className="rounded-xl border border-[#E6E8E3] bg-white px-3.5 py-3 text-xs font-medium text-[#1A2E26] opacity-100 shadow-xs"
              >
                {card.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden JSON Import Input */}
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleImportFile}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* 1. Top Header Bar */}
      <PageHeader parent={{ label: "Boards", href: "/" }} title={boardName} />

      {/* Main Content Container */}
      <div className="flex w-full min-w-0 flex-1 flex-col px-4 pt-4 pb-4 sm:px-6 sm:pt-5">
        {/* 2. Board Hero Banner (Sage Green Card) */}
        <section
          aria-label="Board summary"
          className="relative flex flex-col justify-between gap-4 rounded-2xl bg-[#DCE5CC] px-4 py-4 sm:flex-row sm:items-stretch sm:gap-6 sm:px-7 sm:py-6"
        >
          {/* Left Side: Code, Serif Italic Title, Description & Workspace Meta */}
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="pr-16 sm:pr-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4E6356] sm:text-[11px]">
                BOARD / {boardCode}
              </p>
              <h1 className="mt-1 truncate font-serif text-2xl italic tracking-tight text-[#162B22] sm:text-[34px] sm:leading-tight">
                {boardName}
              </h1>
              <div className="group/md mt-1.5 max-w-2xl rounded-lg px-2 py-1 -mx-2 transition-colors hover:bg-[#CFDAB9]/75">
                <p className="text-xs leading-relaxed text-[#3F5347] transition-colors group-hover/md:text-[#162B22] sm:text-[13px]">
                  {DEFAULT_BOARD_DESCRIPTION}
                </p>
              </div>
            </div>

            <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs text-[#465B4F] sm:mt-4 sm:gap-2.5">
              <span className="inline-flex items-center gap-1.5">
                {members.length > 1 ? (
                  <>
                    <Users size={13} strokeWidth={1.75} aria-hidden="true" />
                    <span>Shared board</span>
                  </>
                ) : (
                  <>
                    <Lock size={13} strokeWidth={1.75} aria-hidden="true" />
                    <span>Private board</span>
                  </>
                )}
              </span>
              <span aria-hidden="true" className="text-[#788B7E]">
                ·
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#465B4F]/40 text-[10px] font-semibold">
                  {ownerName.charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{workspaceLabel}</span>
              </span>
            </div>
          </div>

          {/* Right Side: Favorite, More Menu & Progress Tracker */}
          <div className="flex shrink-0 flex-col justify-between sm:items-end">
            <div className="absolute top-3.5 right-3.5 flex items-center gap-1 sm:static sm:self-end">
              <button
                type="button"
                onClick={handleToggleFavorite}
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
                label="Board options"
                symbolNode={<MoreHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />}
                triggerClassName="h-8 w-8 cursor-pointer border-0 bg-transparent text-[#2C4236] hover:bg-black/5"
                items={[
                  {
                    id: "share-board",
                    label: "Manage members",
                    onSelect: () => setIsShareOpen(true),
                  },
                  { id: "export", label: "Export JSON", onSelect: handleExport },
                  {
                    id: "import",
                    label: "Import JSON",
                    onSelect: () => importInputRef.current?.click(),
                  },
                ]}
              />
            </div>

            <div className="mt-1 sm:mt-6 sm:min-w-[210px]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4E6356]">
                A LITTLE PROGRESS, EVERY DAY
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-semibold tracking-tight text-[#162B22] sm:text-2xl">
                  {completedCards} of {totalCards}
                </span>
                <span className="text-xs text-[#465B4F]">tasks complete</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={completionPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Board completion progress"
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

        {/* 3. View Switcher Tabs & Share Board Button */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 border-b border-[#E6E8E3] sm:gap-3">
          <div
            role="tablist"
            aria-label="Board views"
            className="flex items-center gap-4 sm:gap-6"
          >
            <button
              type="button"
              role="tab"
              aria-selected={boardView === "kanban"}
              onClick={() => setBoardView("kanban")}
              className={`inline-flex cursor-pointer items-center gap-1.5 border-b-2 pb-2.5 text-xs font-medium transition-colors sm:gap-2 sm:pb-3 sm:text-[13px] ${
                boardView === "kanban"
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
              aria-selected={boardView === "list"}
              onClick={() => setBoardView("list")}
              className={`inline-flex cursor-pointer items-center gap-1.5 border-b-2 pb-2.5 text-xs font-medium transition-colors sm:gap-2 sm:pb-3 sm:text-[13px] ${
                boardView === "list"
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
              aria-selected={boardView === "calendar"}
              onClick={() => setBoardView("calendar")}
              className={`inline-flex cursor-pointer items-center gap-1.5 border-b-2 pb-2.5 text-xs font-medium transition-colors sm:gap-2 sm:pb-3 sm:text-[13px] ${
                boardView === "calendar"
                  ? "border-[#16382C] text-[#162B22]"
                  : "border-transparent text-[#6E7A73] hover:text-[#162B22]"
              }`}
            >
              <CalendarIcon size={15} strokeWidth={1.75} aria-hidden="true" />
              <span>Calendar</span>
            </button>
          </div>

          <div className="pb-2 sm:pb-2.5">
            <button
              type="button"
              onClick={() => setIsShareOpen(true)}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#DCDFD8] bg-white px-2.5 text-xs font-medium text-[#1A2E26] shadow-2xs transition-colors hover:bg-[#F3F4F0] sm:px-3"
            >
              <UserPlus size={14} strokeWidth={1.75} aria-hidden="true" />
              <span>Share board</span>
              {members.length > 1 && (
                <span className="ml-0.5 rounded-full bg-[#DCE5CC] px-1.5 py-0.2 text-[10px] font-semibold text-[#16382C]">
                  {members.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 4. Filter, Search & Primary Actions Toolbar */}
        <div className="mt-4 flex flex-col items-stretch gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          {/* Left Controls: Search, Sort, Task Count */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <div ref={taskSearchContainerRef} className="relative min-w-0 flex-1 sm:flex-initial">
              <label className="flex h-9 w-full items-center gap-2 rounded-lg border border-[#DCDFD8] bg-[#F0F0EA] px-2.5 transition-colors focus-within:border-[#16382C] focus-within:bg-white sm:h-8.5 sm:w-56">
                <Search
                  size={14}
                  strokeWidth={1.75}
                  className="shrink-0 text-[#7C8178]"
                  aria-hidden="true"
                />
                <input
                  ref={taskSearchInputRef}
                  type="search"
                  value={filters.keyword}
                  onFocus={() => setSearchDropdownOpen(true)}
                  onChange={(e) => {
                    setKeyword(e.target.value);
                    setSearchActiveIndex(0);
                    setSearchDropdownOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      if (showQuickSearchPanel) {
                        setSearchDropdownOpen(false);
                      } else if (filters.keyword) {
                        setKeyword("");
                      } else {
                        taskSearchInputRef.current?.blur();
                      }
                    } else if (
                      e.key === "ArrowDown" &&
                      quickSearchItems.length > 0
                    ) {
                      e.preventDefault();
                      setSearchDropdownOpen(true);
                      setSearchActiveIndex((prev) =>
                        Math.min(prev + 1, quickSearchItems.length - 1),
                      );
                    } else if (
                      e.key === "ArrowUp" &&
                      quickSearchItems.length > 0
                    ) {
                      e.preventDefault();
                      setSearchDropdownOpen(true);
                      setSearchActiveIndex((prev) => Math.max(prev - 1, 0));
                    } else if (
                      e.key === "Enter" &&
                      showQuickSearchPanel &&
                      quickSearchItems[clampedSearchIndex]
                    ) {
                      e.preventDefault();
                      handleOpenQuickTask(
                        quickSearchItems[clampedSearchIndex].card.id,
                      );
                    }
                  }}
                  placeholder="Search tasks..."
                  aria-label="Search tasks"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={showQuickSearchPanel}
                  aria-controls="board-task-quick-results"
                  aria-activedescendant={
                    showQuickSearchPanel && quickSearchItems[clampedSearchIndex]
                      ? `board-task-option-${quickSearchItems[clampedSearchIndex].card.id}`
                      : undefined
                  }
                  className="w-full min-w-0 bg-transparent text-base text-[#24483D] outline-none placeholder:text-[#92968D] sm:text-xs [&::-webkit-search-cancel-button]:hidden"
                />
                {filters.keyword ? (
                  <button
                    type="button"
                    onClick={() => {
                      setKeyword("");
                      setSearchActiveIndex(0);
                      setSearchDropdownOpen(false);
                      taskSearchInputRef.current?.focus();
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

              {showQuickSearchPanel && (
                <div
                  id="board-task-quick-results"
                  role="listbox"
                  className="absolute left-0 top-10 z-40 max-h-[65dvh] w-[calc(100vw-2rem)] max-w-80 overflow-y-auto rounded-lg border border-[#E9E8E1] bg-white p-1.5 shadow-lg sm:top-9.5 sm:max-h-72 sm:w-80"
                >
                  {quickSearchItems.length === 0 ? (
                    <p className="px-3 py-4 text-center text-[11px] text-[#7C8178]">
                      No matching tasks for &ldquo;{filters.keyword.trim()}&rdquo;
                    </p>
                  ) : (
                    <>
                      <p className="px-2 pt-1 pb-1 text-[9px] font-semibold uppercase tracking-wide text-[#92968D]">
                        Matching tasks
                      </p>
                      {quickSearchItems.map(({ card, columnName }, idx) => {
                        const isActive = idx === clampedSearchIndex;
                        return (
                          <button
                            key={card.id}
                            id={`board-task-option-${card.id}`}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onMouseEnter={() => setSearchActiveIndex(idx)}
                            onClick={() => handleOpenQuickTask(card.id)}
                            className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors sm:py-1.5 ${
                              isActive ? "bg-[#F0F0EA]" : "hover:bg-[#FAF9F6]"
                            }`}
                          >
                            <CheckSquare
                              size={13}
                              className="shrink-0 text-[#24483D]"
                              aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium text-[#24483D] sm:text-[11px]">
                                {card.title}
                              </span>
                              <span className="block truncate text-[10px] text-[#7C8178]">
                                {columnName}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>

            <ActionMenu
              label="Sort tasks"
              symbolNode={
                <span className="inline-flex items-center gap-1.5 px-2.5 text-xs font-medium text-[#1A2E26]">
                  <ArrowUpDown size={13} strokeWidth={1.75} aria-hidden="true" />
                  <span>Sort</span>
                </span>
              }
              triggerClassName="h-9 w-auto shrink-0 cursor-pointer rounded-lg border border-[#DCDFD8] bg-white hover:bg-[#F3F4F0] sm:h-8.5"
              items={[
                {
                  id: "sort-manual",
                  label: `${sortBy === "manual" ? "✓ " : ""}Manual order`,
                  onSelect: () => setSortBy("manual"),
                },
                {
                  id: "sort-due",
                  label: `${sortBy === "due" ? "✓ " : ""}Due date`,
                  onSelect: () => setSortBy("due"),
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

            <span className="shrink-0 pl-0.5 text-xs text-[#6E7A73] sm:pl-1">
              {activeCount > 0 ? `${visibleCards} of ${totalCards} tasks` : `${totalCards} tasks`}
            </span>
          </div>

          {/* Right Controls: Group by, + New task, More (...) */}
          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end sm:gap-2.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#6E7A73]">Group by</span>
              <ActionMenu
                label="Group tasks by"
                symbolNode={
                  <span className="inline-flex items-center gap-1.5 px-2.5 text-xs font-medium text-[#1A2E26]">
                    <span>{groupBy === "priority" ? "Priority" : "Status"}</span>
                    <ChevronDown size={13} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                }
                triggerClassName="h-9 w-auto cursor-pointer rounded-lg border border-[#DCDFD8] bg-white hover:bg-[#F3F4F0] sm:h-8.5"
                items={[
                  {
                    id: "group-status",
                    label: `${groupBy === "none" ? "✓ " : ""}Status`,
                    onSelect: () => setGroupBy("none"),
                  },
                  {
                    id: "group-priority",
                    label: `${groupBy === "priority" ? "✓ " : ""}Priority`,
                    onSelect: () => setGroupBy("priority"),
                  },
                ]}
              />
            </div>

            <div className="flex items-center gap-2">
              <BaseButton
                size="sm"
                onClick={handleOpenNewColumn}
                className="h-9 cursor-pointer sm:h-8.5"
              >
                <Plus size={14} strokeWidth={2} aria-hidden="true" />
                <span>New task</span>
              </BaseButton>

              <ActionMenu
                label="More board actions"
                symbolNode={<MoreHorizontal size={15} strokeWidth={1.75} aria-hidden="true" />}
                triggerClassName="h-9 w-9 cursor-pointer rounded-lg border border-[#DCDFD8] bg-white text-[#1A2E26] hover:bg-[#F3F4F0] sm:h-8.5 sm:w-8.5"
                items={[
                  {
                    id: "export-json",
                    label: "Export JSON",
                    onSelect: handleExport,
                  },
                  {
                    id: "import-json",
                    label: "Import JSON",
                    onSelect: () => importInputRef.current?.click(),
                  },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Feedback Banners */}
        {noCardMatches && (
          <div className="mt-4 rounded-xl border border-[#DCDFD8] bg-white px-4 py-3">
            <p role="status" className="text-xs text-[#6E7A73]">
              No cards match these filters.
            </p>
          </div>
        )}

        {moveError && (
          <div className="mt-4">
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive"
            >
              {moveError}
            </p>
          </div>
        )}

        {/* 5. Main Board Content (Kanban / List / Calendar) */}
        <div className="mt-5 min-w-0 flex-1">
          {boardColumns.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#CFD3CA] bg-white/60 px-6 py-14 text-center sm:py-16">
              <p className="text-sm font-medium text-[#1A2E26]">This board has no columns yet.</p>
              <p className="mt-1 text-xs text-[#6E7A73]">
                Create your first status column to start organizing tasks.
              </p>
              <BaseButton size="sm" onClick={handleOpenNewColumn} className="mt-4 cursor-pointer">
                <Plus size={14} strokeWidth={2} />
                <span>Add column</span>
              </BaseButton>
            </div>
          ) : boardView === "list" ? (
            <BoardListView
              columns={sortedColumns}
              sortBy={sortBy}
              groupBy={groupBy}
              onOpenCard={(card) => setSelectedCardId(card.id)}
            />
          ) : boardView === "calendar" ? (
            <div className="mx-auto max-w-5xl rounded-2xl border border-[#E6E8E3] bg-white p-2.5 sm:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-serif text-base italic text-[#162B22] sm:text-lg">
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
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#DCDFD8] text-[#1A2E26] transition-colors hover:bg-[#F3F4F0] sm:h-7 sm:w-7"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                    }}
                    className="h-8 cursor-pointer rounded-lg border border-[#DCDFD8] px-2.5 text-[11px] font-medium text-[#1A2E26] transition-colors hover:bg-[#F3F4F0] sm:h-7 sm:px-2"
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
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#DCDFD8] text-[#1A2E26] transition-colors hover:bg-[#F3F4F0] sm:h-7 sm:w-7"
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

              <div className="mt-1.5 grid grid-cols-7 gap-0.5 sm:gap-1">
                {calendarDays.map((cell, idx) => {
                  const dayCards = cell.dateStr ? cardsByDate[cell.dateStr] ?? [] : [];
                  const visibleDayCards = dayCards.slice(0, 2);
                  const remainingCount = dayCards.length - visibleDayCards.length;

                  return (
                    <div
                      key={idx}
                      className={`min-h-14 rounded-lg border p-1 sm:min-h-17 sm:p-1.5 ${
                        cell.dayNumber
                          ? "border-[#ECEEE9] bg-[#FAFBF9]"
                          : "border-transparent bg-transparent"
                      }`}
                    >
                      {cell.dayNumber && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-[#4E6356] sm:text-[11px]">
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
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setSelectedCardId(c.id)}
                                title={`${c.title} (${c.columnName})`}
                                className="block w-full cursor-pointer truncate rounded bg-[#DCE5CC] px-1 py-0.5 text-left text-[9px] font-medium text-[#162B22] transition-colors hover:bg-[#CFDAB9] sm:px-1.5 sm:text-[10px]"
                              >
                                {c.title}
                              </button>
                            ))}
                            {remainingCount > 0 && (
                              <p className="px-0.5 text-[9px] font-medium text-[#6E7A73] sm:px-1">
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
          ) : priorityGroups ? (
            <div className="flex flex-col gap-6">
              {priorityGroups.map((group) => (
                <section
                  key={String(group.key ?? "none")}
                  aria-label={`${group.label} priority group`}
                  data-priority-group={group.key ?? "none"}
                >
                  <h2 className="pb-2.5 text-xs font-semibold uppercase tracking-wider text-[#4E6356]">
                    {group.label}
                  </h2>
                  <div
                    className="flex snap-x snap-mandatory scroll-px-1 gap-4 overflow-x-auto overscroll-x-contain pb-3"
                    role="list"
                    aria-label={`${group.label} priority columns`}
                  >
                    {group.columns.map((col, colIndex) => (
                      <BoardColumn
                        key={col.id}
                        column={col}
                        index={colIndex}
                        boardName={boardName}
                        totalCount={
                          isFiltering && col.cards.length > 0 ? col.total : undefined
                        }
                        dragEnabled={false}
                        onRename={handleRename}
                        onDelete={handleDeleteColumn}
                        onUpdate={handleUpdateColumn}
                        onAddCard={handleAddCard}
                        onOpenCard={(card) => setSelectedCardId(card.id)}
                        dragHandlers={dragHandlers}
                        draggingCardId={draggingCardId}
                        now={now}
                        onDuplicateCard={(card) => handleDuplicateCard(col.id, card)}
                        onDeleteCard={(card) => handleDeleteCard(col.id, card)}
                        showAddCard={addCardTargetColumnId === col.id}
                        onAddCardCancel={() => setAddCardTargetColumnId(null)}
                        columnReorder={undefined}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div
              className="flex snap-x snap-mandatory scroll-px-1 items-start gap-4 overflow-x-auto overscroll-x-contain px-1 pt-1.5 pb-4"
              role="list"
              aria-label={`${boardColumns.length} column${boardColumns.length === 1 ? "" : "s"}`}
            >
              {sortedColumns.map((col, colIndex) => (
                <BoardColumn
                  key={col.id}
                  column={col}
                  index={colIndex}
                  boardName={boardName}
                  totalCount={isFiltering ? col.total : undefined}
                  dragEnabled={!isFiltering}
                  onRename={handleRename}
                  onDelete={handleDeleteColumn}
                  onUpdate={handleUpdateColumn}
                  onAddCard={handleAddCard}
                  onOpenCard={(card) => setSelectedCardId(card.id)}
                  dragHandlers={dragHandlers}
                  draggingCardId={draggingCardId}
                  now={now}
                  onDuplicateCard={(card) => handleDuplicateCard(col.id, card)}
                  onDeleteCard={(card) => handleDeleteCard(col.id, card)}
                  showAddCard={addCardTargetColumnId === col.id}
                  onAddCardCancel={() => setAddCardTargetColumnId(null)}
                  columnReorder={
                    boardColumns.length > 1
                      ? {
                          draggingColumnId,
                          onDragStart: handleColumnDragStart,
                          onDragEnd: handleColumnDragEnd,
                          onDragOver: handleColumnDragOver,
                          onDrop: handleColumnDrop,
                          onMove: handleColumnMove,
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* 6. Bottom Status Footer */}
        <footer className="mt-4 flex flex-wrap items-center justify-center gap-2 pt-2 text-[11px] text-[#7A857E] sm:justify-end">
          <span>All changes saved</span>
          <span aria-hidden="true">·</span>
          <span>Updated just now</span>
        </footer>
      </div>

      {/* Popup Modal: Create Task Name */}
      {isAddingColumn && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-task-popup-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4 backdrop-blur-2xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeNewColumnPopup();
          }}
        >
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#DCDFD8] bg-white p-4 shadow-xl sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2
                id="new-task-popup-title"
                className="text-sm font-semibold text-[#1A2E26]"
              >
                New task name
              </h2>
              <button
                type="button"
                onClick={closeNewColumnPopup}
                disabled={isCreatingColumn}
                aria-label="Close popup"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#6E7A73] transition-colors hover:bg-[#F3F4F0] disabled:cursor-not-allowed disabled:opacity-50 sm:h-7 sm:w-7"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateColumn} noValidate className="flex flex-col gap-3">
              <div>
                <label
                  htmlFor="new-column-name"
                  className="mb-1.5 block text-xs font-medium text-[#3F5347]"
                >
                  Task name
                </label>
                <input
                  ref={newColumnInputRef}
                  id="new-column-name"
                  type="text"
                  value={columnName}
                  maxLength={100}
                  disabled={isCreatingColumn}
                  placeholder="Enter task name..."
                  onChange={(e) => {
                    setColumnName(e.target.value);
                    if (columnError) setColumnError(null);
                  }}
                  aria-invalid={columnError !== null}
                  aria-describedby={columnError ? "new-column-error" : undefined}
                  className="h-10 w-full rounded-lg border border-[#DCDFD8] bg-[#FAF9F6] px-3 text-base text-[#1A2E26] focus:border-[#16382C] focus:bg-white focus:outline-none sm:h-9 sm:text-xs"
                />
                {columnError && (
                  <p id="new-column-error" role="alert" className="mt-1.5 text-xs text-destructive">
                    {columnError}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <BaseButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isCreatingColumn}
                  onClick={closeNewColumnPopup}
                  className="h-9 cursor-pointer sm:h-8.5"
                >
                  Cancel
                </BaseButton>
                <BaseButton
                  type="submit"
                  size="sm"
                  disabled={isCreatingColumn}
                  className="h-9 cursor-pointer sm:h-8.5"
                >
                  Create task
                </BaseButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Board Modal */}
      {isShareOpen && (
        <ShareBoardDialog
          boardId={boardId}
          boardName={boardName}
          shareUrl={shareUrl}
          token={token as string}
          initialMembers={members}
          canManage={canManageMembers}
          onClose={() => setIsShareOpen(false)}
          onMembersSynced={handleMembersSynced}
        />
      )}

      {/* Card Detail Modal */}
      {selectedCard && (
        <CardDetailModal
          isOpen
          onClose={() => setSelectedCardId(null)}
          card={selectedCard}
          columns={boardColumns.map((c) => ({
            id: c.id,
            name: c.name,
            cards: c.cards,
          }))}
          onCardUpdated={handleCardUpdated}
          onCardDeleted={handleCardDeleted}
          onCardMoved={refetch}
          boardId={boardId}
          boardLabels={boardLabels}
          labelUsage={labelUsage}
          onLabelsChanged={refetch}
          boardMembers={members}
          isBoardOwner={role === "owner"}
          onCardAssigneesChanged={refetch}
        />
      )}
    </div>
  );
}