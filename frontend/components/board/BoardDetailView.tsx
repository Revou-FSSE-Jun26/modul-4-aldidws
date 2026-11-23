"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { get } from "@/lib/apiClient";
import { ApiError } from "@/lib/errors";
import { ColumnHeader } from "@/components/board/ColumnHeader";
import { BoardCard } from "@/components/board/BoardCard";

// ---------------------------------------------------------------------------
// Domain types — mirror backend serialisation shapes
// ---------------------------------------------------------------------------

interface Board {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface Card {
  id: string;
  column_id: string;
  title: string;
  description: string;
  position: number;
  created_at: string;
  updated_at: string;
}

interface Column {
  id: string;
  board_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
  /** Cards belonging to this column, populated client-side after fetch. */
  cards: Card[];
}

// ---------------------------------------------------------------------------
// Fetch helpers (authenticated through the shared API client)
// ---------------------------------------------------------------------------

/** 404/405 on an optional list endpoint means "not implemented yet". */
function isEndpointMissing(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.statusCode === 404 || err.statusCode === 405)
  );
}

async function fetchColumns(token: string, boardId: string): Promise<Column[]> {
  // GET /api/boards/<boardId>/columns is not yet implemented on the backend.
  // Until it ships, a 404/405 is treated as "no columns".
  try {
    const columns = await get<Column[]>(`/api/boards/${boardId}/columns`, {
      token,
    });
    // Columns arrive without cards; initialise the cards array here.
    return columns.map((col) => ({ ...col, cards: [] }));
  } catch (err) {
    if (isEndpointMissing(err)) return [];
    throw err;
  }
}

async function fetchCardsForColumn(
  token: string,
  columnId: string,
): Promise<Card[]> {
  // GET /api/v1/cards?column_id=<id> is not yet implemented; 404/405 => empty.
  try {
    return await get<Card[]>(
      `/api/v1/cards?column_id=${encodeURIComponent(columnId)}`,
      { token },
    );
  } catch (err) {
    if (isEndpointMissing(err)) return [];
    throw err;
  }
}

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

type ViewState =
  | { status: "idle" }
  | { status: "success"; board: Board; columns: Column[] }
  | { status: "error"; message: string };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface BoardDetailViewProps {
  boardId: string;
}

/**
 * Client Component that fetches a board with its columns and cards,
 * then renders a horizontal Kanban-style layout.
 *
 * Unauthenticated users are redirected to /login by `useRequireAuth` only
 * after AuthContext has finished loading. An expired token (401) also
 * redirects to /login.
 */
export function BoardDetailView({ boardId }: BoardDetailViewProps) {
  const router = useRouter();
  const { token, isAuthLoading } = useRequireAuth();
  const [state, setState] = useState<ViewState>({ status: "idle" });

  useEffect(() => {
    if (isAuthLoading || !token) return;

    let cancelled = false;
    const t = token;

    async function load() {
      const [board, columns] = await Promise.all([
        get<Board>(`/api/boards/${boardId}`, { token: t }),
        fetchColumns(t, boardId),
      ]);

      // Fetch cards for all columns in parallel.
      const columnsWithCards = await Promise.all(
        columns.map(async (col) => {
          const cards = await fetchCardsForColumn(t, col.id);
          return { ...col, cards };
        }),
      );

      // Sort columns by position for a deterministic render order.
      columnsWithCards.sort((a, b) => a.position - b.position);

      if (!cancelled) {
        setState({ status: "success", board, columns: columnsWithCards });
      }
    }

    load().catch((err: unknown) => {
      if (cancelled) return;
      if (err instanceof ApiError && err.isUnauthorized) {
        router.replace("/login");
        return;
      }
      let message = "Could not load this board. Please try again.";
      if (err instanceof ApiError) {
        message = err.isNotFound ? "Board not found." : err.message;
      }
      setState({ status: "error", message });
    });

    return () => {
      cancelled = true;
    };
  }, [token, isAuthLoading, boardId, router]);

  // ----- Loading (auth loading, redirecting to /login, or fetch in flight) -----
  if (isAuthLoading || !token || state.status === "idle") {
    return (
      <div
        className="flex gap-4 overflow-x-auto px-4 py-8 sm:px-6 lg:px-8 pb-4"
        aria-busy="true"
        aria-label="Loading board"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
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

  const { board, columns } = state;

  // ----- Success -----
  return (
    <>
      {/* Page header — board name */}
      <header className="border-b border-border bg-background px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {board.name}
        </h1>
      </header>

      {/* Column strip */}
      {columns.length === 0 ? (
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">
            This board has no columns yet.
          </p>
        </div>
      ) : (
        <div
          className="flex gap-4 overflow-x-auto px-4 py-6 sm:px-6 lg:px-8 pb-8"
          role="list"
          aria-label={`${columns.length} column${columns.length === 1 ? "" : "s"}`}
        >
          {columns.map((col) => (
            <section
              key={col.id}
              role="listitem"
              aria-label={col.name}
              className="flex w-64 shrink-0 flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3"
            >
              {/* Column heading with card count */}
              <ColumnHeader
                title={col.name}
                cardCount={col.cards.length}
                // onRename and onColumnDelete are intentionally omitted —
                // mutations require additional service wiring beyond this
                // read-only view. They can be wired up when the edit flow
                // is implemented.
              />

              {/* Card list */}
              {col.cards.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">
                  No cards in this column.
                </p>
              ) : (
                <ul className="flex list-none flex-col gap-2 p-0">
                  {col.cards
                    .slice()
                    .sort((a, b) => a.position - b.position)
                    .map((card) => (
                      <li key={card.id}>
                        <BoardCard title={card.title} />
                      </li>
                    ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
