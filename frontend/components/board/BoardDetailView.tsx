"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
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
// Fetch helpers
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

async function fetchBoard(token: string, boardId: string): Promise<Board> {
  const res = await fetch(`${API_BASE}/api/boards/${boardId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch board (${res.status})`);
  const json = (await res.json()) as { data: Board };
  return json.data;
}

async function fetchColumns(token: string, boardId: string): Promise<Column[]> {
  // GET /api/boards/<boardId>/columns is not yet implemented on the backend.
  // When it ships it should return { data: Column[] }.
  // Until then we return an empty array so the page renders gracefully.
  const res = await fetch(`${API_BASE}/api/boards/${boardId}/columns`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  // 404 means the endpoint doesn't exist yet — treat as empty.
  if (res.status === 404 || res.status === 405) return [];
  if (!res.ok) throw new Error(`Failed to fetch columns (${res.status})`);

  const json = (await res.json()) as { data: Column[] };
  // Columns arrive without cards; initialise the cards array here.
  return json.data.map((col) => ({ ...col, cards: [] }));
}

async function fetchCardsForColumn(
  token: string,
  columnId: string,
): Promise<Card[]> {
  // GET /api/v1/cards?column_id=<id> is not yet implemented.
  // Returns empty until the endpoint exists.
  const res = await fetch(
    `${API_BASE}/api/v1/cards?column_id=${columnId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  if (res.status === 404 || res.status === 405) return [];
  if (!res.ok) throw new Error(`Failed to fetch cards (${res.status})`);
  const json = (await res.json()) as { data: Card[] };
  return json.data;
}

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

type ViewState =
  | { status: "idle" }
  | { status: "loading" }
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
 * Uses `"use client"` because it consumes AuthContext and manages local state.
 *
 * Layout:
 *   - Board name in a sticky page header
 *   - Horizontally scrollable row of columns
 *   - Each column contains a <ColumnHeader> and a vertical list of <BoardCard>
 */
export function BoardDetailView({ boardId }: BoardDetailViewProps) {
  const { token, isLoading: isAuthLoading } = useAuth();
  const [state, setState] = useState<ViewState>({ status: "idle" });

  useEffect(() => {
    if (isAuthLoading || !token) return;

    // token is guaranteed non-null here (checked above).
    // All setState calls happen inside async callbacks so they are never
    // synchronous within the effect body, satisfying react-hooks/set-state-in-effect.
    const t = token;

    async function load() {
      const [board, columns] = await Promise.all([
        fetchBoard(t, boardId),
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

      setState({ status: "success", board, columns: columnsWithCards });
    }

    load().catch((err: unknown) => {
      setState({
        status: "error",
        message:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    });
  }, [token, isAuthLoading, boardId]);

  // ----- Unauthenticated — derived directly from context, no effect needed -----
  if (!isAuthLoading && !token) {
    return (
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          You must be signed in to view this board.
        </div>
      </div>
    );
  }

  // ----- Loading -----
  if (state.status === "idle" || state.status === "loading" || isAuthLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto px-4 py-8 sm:px-6 lg:px-8 pb-4"
           aria-busy="true"
           aria-label="Loading board">
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
