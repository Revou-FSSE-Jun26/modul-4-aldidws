"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useDragAndDrop, type ColumnCardMap } from "@/hooks/useDragAndDrop";
import { getBoard } from "@/lib/services/boardsService";
import {
  createColumn,
  deleteColumn,
  renameColumn,
} from "@/lib/services/columnsService";
import { createCard } from "@/lib/services/cardsService";
import { ApiError } from "@/lib/errors";
import { loginPath } from "@/lib/loginPath";
import type { Card, ColumnWithCards } from "@/lib/types/api";
import { BaseButton } from "@/components/shared/BaseButton";
import { BoardColumn } from "@/components/board/BoardColumn";
import { CardDetailModal } from "@/components/board/CardDetailModal";
import { SearchBar } from "@/components/board/SearchBar";

type ViewState =
  | { status: "idle" }
  | { status: "success"; boardName: string; columns: ColumnWithCards[] }
  | { status: "error"; message: string };

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
  const [state, setState] = useState<ViewState>({ status: "idle" });
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [columnName, setColumnName] = useState("");
  const [columnError, setColumnError] = useState<string | null>(null);
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);

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

  const { boardName, columns: boardColumns } = state;
  const selectedCard: Card | undefined = boardColumns
    .flatMap((c) => c.cards)
    .find((c) => c.id === selectedCardId);

  function updateColumns(fn: (cols: ColumnWithCards[]) => ColumnWithCards[]) {
    setState((prev) =>
      prev.status === "success" ? { ...prev, columns: fn(prev.columns) } : prev,
    );
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

  async function handleDeleteColumn(columnId: string) {
    await deleteColumn(token as string, columnId);
    updateColumns((cols) => cols.filter((c) => c.id !== columnId));
  }

  async function handleAddCard(columnId: string, title: string) {
    const created = await createCard(token as string, columnId, { title });
    updateColumns((cols) =>
      cols.map((c) =>
        c.id === columnId ? { ...c, cards: [...c.cards, created] } : c,
      ),
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

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-border bg-background px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {boardName}
          </h1>
          {!isAddingColumn && (
            <BaseButton onClick={() => setIsAddingColumn(true)}>Add column</BaseButton>
          )}
        </div>

        {isAddingColumn && (
          <form
            onSubmit={handleCreateColumn}
            noValidate
            className="flex max-w-md flex-col gap-2"
          >
            <label htmlFor="new-column-name" className="text-sm font-medium text-foreground">
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
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {columnError && (
              <p id="new-column-error" role="alert" className="text-xs text-destructive">
                {columnError}
              </p>
            )}
            <div className="flex gap-2">
              <BaseButton type="submit" disabled={isCreatingColumn}>
                Create column
              </BaseButton>
              <BaseButton
                variant="secondary"
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

        <SearchBar
          boardId={boardId}
          onSelect={(card) => {
            setSelectedCardId(card.id);
            if (!boardColumns.some((c) => c.cards.some((x) => x.id === card.id))) {
              refetch();
            }
          }}
        />
      </header>

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

      {boardColumns.length === 0 ? (
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">This board has no columns yet.</p>
        </div>
      ) : (
        <div
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 py-6 pb-8 sm:px-6 lg:px-8"
          role="list"
          aria-label={`${boardColumns.length} column${boardColumns.length === 1 ? "" : "s"}`}
        >
          {boardColumns.map((col) => (
            <BoardColumn
              key={col.id}
              column={col}
              onRename={handleRename}
              onDelete={handleDeleteColumn}
              onAddCard={handleAddCard}
              onOpenCard={(card) => setSelectedCardId(card.id)}
              dragHandlers={dragHandlers}
              draggingCardId={draggingCardId}
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
        />
      )}
    </>
  );
}
