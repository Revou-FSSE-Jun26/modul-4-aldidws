"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useNow } from "@/hooks/useNow";
import { useDragAndDrop, type ColumnCardMap } from "@/hooks/useDragAndDrop";
import { useBoardFilters } from "@/hooks/useBoardFilters";
import { useFilterShortcut } from "@/hooks/useFilterShortcut";
import { countActiveFilters, filterColumns } from "@/lib/filterCards";
import { sortColumns, type SortBy } from "@/lib/sortCards";
import { groupByPriority, type GroupBy } from "@/lib/groupCards";
import { getBoard } from "@/lib/services/boardsService";
import {
  createColumn,
  deleteColumn,
  renameColumn,
  updateColumn,
  reorderColumns,
} from "@/lib/services/columnsService";
import { createCard, deleteCard, setCardLabels } from "@/lib/services/cardsService";
import { createLabel } from "@/lib/services/labelsService";
import { exportBoard, validateImport, type ExportedColumn } from "@/lib/boardImportExport";
import { ApiError } from "@/lib/errors";
import { loginPath } from "@/lib/loginPath";
import { moveItem } from "@/lib/columnOrder";
import { showError, showSuccess, showLoading, dismissToast } from "@/lib/toast";
import type { Card, ColumnColor, ColumnWithCards, Label } from "@/lib/types/api";
import { BaseButton } from "@/components/shared/BaseButton";
import { BoardColumn } from "@/components/board/BoardColumn";
import { BoardListView } from "@/components/board/BoardListView";
import { AddNewSplitButton } from "@/components/board/AddNewSplitButton";
import { CardDetailModal } from "@/components/board/CardDetailModal";
import { FilterBar } from "@/components/board/FilterBar";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { BackgroundPicker } from "@/components/board/BackgroundPicker";
import { useOptionalBoardBgContext } from "@/components/board/BoardBgWrapper";
import { Kanban, Import, ChevronDown } from "lucide-react";

type BoardView = "kanban" | "list";

import { BoardMembersPanel } from "@/components/board/BoardMembersPanel";
import type { BoardMember, BoardRole } from "@/lib/types/api";

type ViewState =
  | { status: "idle" }
  | {
      status: "success";
      boardName: string;
      columns: ColumnWithCards[];
      labels: Label[];
      role: BoardRole;
      members: BoardMember[];
    }
  | { status: "error"; message: string };

const NO_LABELS: Label[] = [];

/** Distinct dataTransfer type so column drags are never mistaken for card drags. */
const COLUMN_DRAG_TYPE = "application/x-revotask-column";

interface BoardDetailViewProps {
  boardId: string;
}

/**
 * Board page. Loads the board with its columns and cards in one request
 * (GET /api/boards/{id}), then supports adding columns and cards, renaming and
 * deleting columns, drag and drop, search and the card dialog.
 *
 * Unauthenticated users are redirected to /login?next=... by `useRequireAuth`
 * once AuthContext has finished loading. An expired token (401) does the same.
 */
export function BoardDetailView({ boardId }: BoardDetailViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, isAuthLoading } = useRequireAuth();
  const now = useNow();
  // Board background picker — only available when rendered inside BoardBgWrapper.
  const boardBg = useOptionalBoardBgContext();
  const [state, setState] = useState<ViewState>({ status: "idle" });
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [columnName, setColumnName] = useState("");
  const [columnError, setColumnError] = useState<string | null>(null);
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  const [addCardTarget, setAddCardTarget] = useState<{ columnId: string; nonce: number } | null>(null);
  const draggedColumnRef = useRef<string | null>(null);
  // Column whose drag handle should regain focus after a keyboard move.
  const focusColumnRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (isAuthLoading || !token) return;
    let cancelled = false;
    getBoard(token, boardId)
      .then((board) => {
        if (cancelled) return;
        setState({
          status: "success",
          boardName: board.name,
          columns: [...board.columns].sort((a, b) => a.position - b.position),
          labels: board.labels ?? [],
          role: board.role ?? "owner",
          members: board.members ?? [],
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const next = handleLoadError(err);
        if (next) setState(next);
      });
    return () => {
      cancelled = true;
    };
  }, [token, isAuthLoading, boardId, reloadKey, handleLoadError]);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  const columnsForFocus = state.status === "success" ? state.columns : null;
  useEffect(() => {
    const id = focusColumnRef.current;
    if (!id) return;
    focusColumnRef.current = null;
    document.querySelector<HTMLElement>(`[data-column-handle="${id}"]`)?.focus();
  }, [columnsForFocus]);

  const columns = state.status === "success" ? state.columns : null;

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

  // ----- Filters (client-side, URL-backed). Hooks stay above the early returns. -----
  const loadedLabels = state.status === "success" ? state.labels : NO_LABELS;
  const validLabelIds = useMemo(() => loadedLabels.map((l) => l.id), [loadedLabels]);
  const { filters, debouncedKeyword, activeCount, setKeyword, setLabelIds, setDue, setPriority, clear } =
    useBoardFilters(validLabelIds);
  const [filterOpen, setFilterOpen] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);
  const [sortBy, setSortBy] = useState<SortBy>("manual");
  const [boardView, setBoardView] = useState<BoardView>("kanban");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const importInputRef = useRef<HTMLInputElement>(null);
  useFilterShortcut(
    useCallback(() => {
      setFilterOpen(true);
      setFocusSignal((n) => n + 1);
    }, []),
  );

  const filteredColumns = useMemo(
    () => filterColumns(columns ?? [], filters, now),
    [columns, filters, now],
  );
  const sortedColumns = useMemo(
    () => sortColumns(filteredColumns, sortBy),
    [filteredColumns, sortBy],
  );
  /** Priority groups for kanban grouping. Only computed when groupBy=priority. */
  const priorityGroups = useMemo(
    () => (groupBy === "priority" ? groupByPriority(sortedColumns) : null),
    [groupBy, sortedColumns],
  );
  const filterStatus = useMemo(() => {
    const statusFilters = { ...filters, keyword: debouncedKeyword };
    if (countActiveFilters(statusFilters) === 0) return null;
    const shown = filterColumns(columns ?? [], statusFilters, now).reduce(
      (sum, c) => sum + c.cards.length,
      0,
    );
    const total = (columns ?? []).reduce((sum, c) => sum + c.cards.length, 0);
    return { shown, total };
  }, [columns, filters, debouncedKeyword, now]);

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

  // ----- Loading (auth loading, redirecting to /login, or fetch in flight) -----
  // Scroll the targeted column into view when the split button opens AddCardForm in it.
  // Must be declared here (before early returns) to satisfy Rules of Hooks.
  useEffect(() => {
    if (!addCardTarget) return;
    const el = document.querySelector<HTMLElement>(
      `[data-column-id="${addCardTarget.columnId}"]`,
    );
    if (typeof el?.scrollIntoView === "function") {
      el.scrollIntoView({ inline: "start", block: "nearest" });
    }
  }, [addCardTarget]);

  if (isAuthLoading || !token || state.status === "idle") {
    return (
      <div
        className="flex gap-4 overflow-x-auto px-4 py-8 pb-4 sm:px-6 lg:px-8"
        aria-busy="true"
        aria-label="Loading board"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
             
            key={i}
            className="flex w-64 shrink-0 flex-col gap-2"
            aria-hidden="true"
          >
            <div className="h-5 w-32 animate-pulse rounded bg-muted" />
            <div className="h-20 animate-pulse rounded-md border border-border bg-muted" />
            <div className="h-20 animate-pulse rounded-md border border-border bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  // ----- Error -----
  if (state.status === "error") {
    return (
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.message}
        </div>
      </div>
    );
  }

  const { boardName, columns: boardColumns, labels: boardLabels, role, members } = state;
  const canManageMembers = role === "owner";
  const labelUsage: Record<string, number> = {};
  for (const col of boardColumns) {
    for (const c of col.cards) {
      if (!c.labels) continue;
      for (const l of c.labels) labelUsage[l.id] = (labelUsage[l.id] ?? 0) + 1;
    }
  }
  const isFiltering = activeCount > 0 || sortBy !== "manual";
  const totalCards = boardColumns.reduce((sum, c) => sum + c.cards.length, 0);
  const visibleCards = filteredColumns.reduce((sum, c) => sum + c.cards.length, 0);
  const noCardMatches = activeCount > 0 && totalCards > 0 && visibleCards === 0;
  const selectedCard: Card | undefined = boardColumns
    .flatMap((c) => c.cards)
    .find((c) => c.id === selectedCardId);

  // ----- Export handler -----
  function handleExport() {
    if (state.status !== "success") return;
    const json = exportBoard({
      id: boardId,
      name: boardName,
      user_id: "",
      is_favorite: false,
      created_at: "",
      updated_at: "",
      columns: boardColumns,
      labels: boardLabels,
    });
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${boardName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ----- Import handler -----
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so the same file can be re-selected after a failure.
    e.target.value = "";
    if (!file) return;

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
    // Local mutable cache for labels created during this import run.
    const labelCache: Label[] = state.status === "success" ? [...state.labels] : [];

    try {
      for (const col of data.board.columns as ExportedColumn[]) {
        let newColId: string;
        try {
          const created = await createColumn(token as string, boardId, col.name);
          newColId = created.id;
        } catch {
          failures.push(`Column "${col.name}": failed to create.`);
          continue;
        }

        const colCards = col.cards ?? [];
        for (const cardData of colCards) {
          let createdCardId: string;
          try {
            const createdCard = await createCard(token as string, newColId, {
              title: cardData.title,
              description: cardData.description ?? undefined,
              priority: (cardData.priority as "low" | "medium" | "high" | undefined) ?? undefined,
              due_date: cardData.due_date ?? undefined,
            });
            createdCardId = createdCard.id;
          } catch {
            failures.push(`Card "${cardData.title}" in column "${col.name}": failed to create.`);
            continue;
          }

          if (cardData.labels && cardData.labels.length > 0) {
            try {
              // Resolve labels: match by name case-insensitively, create if missing.
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
                      color: (importLabel.color as "blue" | "sky" | "graphite" | "silver" | "red" | "orange" | "green" | "purple") ?? "graphite",
                    });
                    labelCache.push(created);
                    labelIds.push(created.id);
                  } catch {
                    // If label creation fails, skip that label but continue.
                    failures.push(`Label "${importLabel.name}" for card "${cardData.title}": could not create.`);
                  }
                }
              }
              if (labelIds.length > 0) {
                await setCardLabels(token as string, createdCardId, labelIds);
              }
            } catch {
              failures.push(`Labels for card "${cardData.title}": failed to apply.`);
            }
          }
        }
      }
    } finally {
      dismissToast(toastId);
    }

    // Reload board to reflect all created columns/cards.
    refetch();

    if (failures.length === 0) {
      showSuccess("Import complete.");
    } else {
      showError(`Import finished with issues:\n${failures.slice(0, 5).join("\n")}${failures.length > 5 ? `\n… and ${failures.length - 5} more` : ""}`);
    }
  }

  function updateColumns(fn: (cols: ColumnWithCards[]) => ColumnWithCards[]) {
    setState((prev) =>
      prev.status === "success" ? { ...prev, columns: fn(prev.columns) } : prev,
    );
  }

  function handleNewTask() {
    if (boardColumns.length === 0) {
      showError("Create a column first");
      return;
    }
    if (boardView === "list") setBoardView("kanban");
    const first = sortedColumns[0] ?? boardColumns[0];
    setAddCardTarget((prev) => ({ columnId: first.id, nonce: (prev?.nonce ?? 0) + 1 }));
  }

  async function handleCreateColumn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = columnName.trim();
    if (!name) {
      setColumnError("Column name is required.");
      return;
    }
    setIsCreatingColumn(true);
    setColumnError(null);
    try {
      const created = await createColumn(token as string, boardId, name);
      updateColumns((cols) => [...cols, { ...created, cards: [] }]);
      setColumnName("");
      setIsAddingColumn(false);
    } catch (err: unknown) {
      const fieldError = err instanceof ApiError ? err.details?.name?.[0] : undefined;
      setColumnError(
        fieldError ?? (err instanceof Error ? err.message : "Could not add the column."),
      );
    } finally {
      setIsCreatingColumn(false);
    }
  }

  async function handleRename(columnId: string, name: string) {
    const updated = await renameColumn(token as string, columnId, name);
    updateColumns((cols) =>
      cols.map((c) => (c.id === columnId ? { ...c, name: updated.name } : c)),
    );
  }

  async function handleUpdateColumn(
    columnId: string,
    patch: { color?: ColumnColor | null; is_done?: boolean },
  ) {
    const updated = await updateColumn(token as string, columnId, patch);
    updateColumns((cols) =>
      cols.map((c) =>
        c.id === columnId ? { ...c, color: updated.color, is_done: updated.is_done } : c,
      ),
    );
  }

  async function handleDeleteColumn(columnId: string) {
    await deleteColumn(token as string, columnId);
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

  /** Optimistic: show the new order, then persist it; restore the old order on failure. */
  async function reorderBoardColumns(orderedIds: string[]) {
    const previousIds = boardColumns.map((c) => c.id);
    orderColumns(orderedIds);
    try {
      await reorderColumns(token as string, boardId, orderedIds);
    } catch {
      orderColumns(previousIds);
      showError("Could not reorder the columns. The previous order was restored.");
    }
  }

  function handleColumnDragStart(e: React.DragEvent<HTMLElement>, columnId: string) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(COLUMN_DRAG_TYPE, columnId);
    draggedColumnRef.current = columnId;
    setDraggingColumnId(columnId);
  }

  function handleColumnDragEnd() {
    draggedColumnRef.current = null;
    setDraggingColumnId(null);
  }

  function handleColumnDragOver(e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
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
    const created = await createCard(
      token as string,
      columnId,
      position ? { title, position } : { title },
    );
    updateColumns((cols) =>
      cols.map((c) => {
        if (c.id !== columnId) return c;
        if (position !== "top") return { ...c, cards: [...c.cards, created] };
        // The server shifts the existing cards down by one when there is no room
        // above the first card; mirror that so local orders stay consistent.
        const shift = c.cards.some((x) => x.order <= created.order) ? 1 : 0;
        return {
          ...c,
          cards: [created, ...c.cards.map((x) => ({ ...x, order: x.order + shift }))],
        };
      }),
    );
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
    const created = await createCard(token as string, columnId, {
      title: card.title,
      description: card.description ?? undefined,
      priority: card.priority ?? undefined,
      due_date: card.due_date ?? undefined,
    });
    // Optimistically append the new card to the column.
    updateColumns((cols) =>
      cols.map((c) =>
        c.id !== columnId ? c : { ...c, cards: [...c.cards, created] },
      ),
    );
    // Apply labels if any.
    if (card.labels && card.labels.length > 0) {
      try {
        const withLabels = await setCardLabels(
          token as string,
          created.id,
          card.labels.map((l) => l.id),
        );
        // Replace the optimistic card with the labeled version.
        updateColumns((cols) =>
          cols.map((c) =>
            c.id !== columnId
              ? c
              : { ...c, cards: c.cards.map((x) => (x.id === created.id ? withLabels : x)) },
          ),
        );
      } catch {
        showError("Card duplicated, but labels could not be copied.");
        return;
      }
    }
    showSuccess("Task duplicated");
  }

  async function handleDeleteCard(columnId: string, card: Card) {
    await deleteCard(token as string, card.id);
    handleCardDeleted(card.id);
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg-panel)] px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Kanban
            size={16}
            strokeWidth={1.5}
            className="shrink-0 text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <h1 className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {boardName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {boardBg && (
            <BackgroundPicker value={boardBg.bgId} onChange={boardBg.setBgId} />
          )}
          <NotificationBell />
        </div>
      </header>

      <FilterBar
        labels={boardLabels}
        filters={filters}
        activeCount={activeCount}
        status={filterStatus}
        open={filterOpen}
        onOpenChange={setFilterOpen}
        focusSignal={focusSignal}
        onKeywordChange={setKeyword}
        onLabelIdsChange={setLabelIds}
        onDueChange={setDue}
        onPriorityChange={setPriority}
        sort={sortBy}
        onSortChange={setSortBy}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        onClear={clear}
        view={boardView}
        onViewChange={setBoardView}
        actions={
          <>
            {/* Imports / Export split button (§4.3) */}
            <div
              role="group"
              aria-label="Import and export"
              className="inline-flex h-9 items-stretch overflow-hidden rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-panel)]"
            >
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 text-[13px] font-medium text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--bg-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)] focus-visible:ring-offset-2"
              >
                <Import
                  size={16}
                  strokeWidth={1.5}
                  className="text-[var(--text-muted)]"
                  aria-hidden="true"
                />
                Import / Export
              </button>
              <span aria-hidden="true" className="w-px bg-[var(--border)]" />
              <ActionMenu
                label="Open import and export menu"
                symbolNode={<ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />}
                triggerClassName="h-9 w-8 border-0 rounded-none hover:bg-[var(--bg-hover)]"
                items={[
                  { id: "export", label: "Export JSON", onSelect: handleExport },
                  {
                    id: "import",
                    label: "Import JSON",
                    onSelect: () => importInputRef.current?.click(),
                  },
                ]}
              />
            </div>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
            {!isAddingColumn && (
              <AddNewSplitButton
                onNewTask={handleNewTask}
                onNewColumn={() => setIsAddingColumn(true)}
              />
            )}
          </>
        }
      />

      {isAddingColumn && (
        <form
          onSubmit={handleCreateColumn}
          noValidate
          className="flex max-w-md flex-col gap-2 border-b border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3"
        >
          <label
            htmlFor="new-column-name"
            className="text-[13px] font-medium text-[var(--text-primary)]"
          >
            Column name
          </label>
          <input
            id="new-column-name"
            type="text"
            value={columnName}
            maxLength={100}
            autoFocus
            disabled={isCreatingColumn}
            onChange={(e) => {
              setColumnName(e.target.value);
              if (columnError) setColumnError(null);
            }}
            aria-invalid={columnError !== null}
            aria-describedby={columnError ? "new-column-error" : undefined}
            className="h-9 rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-input)] px-3 text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-light)]"
          />
          {columnError && (
            <p
              id="new-column-error"
              role="alert"
              className="text-xs text-[var(--accent-red)]"
            >
              {columnError}
            </p>
          )}
          <div className="flex gap-2">
            <BaseButton type="submit" size="sm" disabled={isCreatingColumn}>
              Create column
            </BaseButton>
            <BaseButton
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsAddingColumn(false);
                setColumnName("");
                setColumnError(null);
              }}
            >
              Cancel
            </BaseButton>
          </div>
        </form>
      )}

      {noCardMatches && (
        <div className="px-4 pt-4 sm:px-6 lg:px-8">
          <p role="status" className="text-sm text-muted-foreground">
            No cards match these filters.
          </p>
        </div>
      )}

      {moveError && (
        <div className="px-4 pt-4 sm:px-6 lg:px-8">
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {moveError}
          </p>
        </div>
      )}

      <div className="px-4 sm:px-6 lg:px-8">
        <BoardMembersPanel
          boardId={boardId}
          token={token as string}
          members={members}
          canManage={canManageMembers}
          onChanged={refetch}
        />
      </div>

      {boardColumns.length === 0 ? (
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">This board has no columns yet.</p>
        </div>
      ) : boardView === "list" ? (
        <BoardListView
          columns={sortedColumns}
          sortBy={sortBy}
          groupBy={groupBy}
          onOpenCard={(card) => setSelectedCardId(card.id)}
        />
      ) : priorityGroups ? (
        <div className="flex flex-col gap-6">
          {priorityGroups.map((group) => (
            <section
              key={String(group.key ?? "none")}
              aria-label={`${group.label} priority group`}
              data-priority-group={group.key ?? "none"}
            >
              <h2 className="px-4 pb-2 text-sm font-semibold text-foreground sm:px-6 lg:px-8">
                {group.label}
              </h2>
              <div
                className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
                role="list"
                aria-label={`${group.label} priority columns`}
              >
                {group.columns.map((col, colIndex) => (
                  <BoardColumn
                    key={col.id}
                    column={col}
                    index={colIndex}
                    boardName={boardName}
                    totalCount={isFiltering && col.cards.length > 0 ? col.total : undefined}
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
                    openAddCardSignal={addCardTarget?.columnId === col.id ? addCardTarget.nonce : 0}
                    columnReorder={undefined}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 py-6 pb-8 sm:px-6 lg:px-8"
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
              openAddCardSignal={addCardTarget?.columnId === col.id ? addCardTarget.nonce : 0}
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
    </>
  );
}
