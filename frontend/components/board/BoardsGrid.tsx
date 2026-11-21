"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { BoardCard } from "@/components/board/BoardCard";

// ---------------------------------------------------------------------------
// Domain type — mirrors the backend `board_to_dict()` serialisation
// ---------------------------------------------------------------------------

interface Board {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Fetch helper — kept outside the component so it is not recreated on render
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

async function fetchBoards(token: string): Promise<Board[]> {
  const response = await fetch(`${API_BASE}/api/boards`, {
    headers: { Authorization: `Bearer ${token}` },
    // Per frontend.md §7.3: explicitly opt out of Next.js default caching for
    // authenticated, user-specific data to prevent cross-user cache leakage.
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch boards (${response.status})`);
  }

  const json = (await response.json()) as { data: Board[] };
  return json.data;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; boards: Board[] }
  | { status: "error"; message: string };

/**
 * Fetches `GET /api/boards` with the in-memory access token from AuthContext
 * and renders a responsive grid of <BoardCard> tiles.
 *
 * Uses `"use client"` because it consumes AuthContext and manages local state.
 * Kept as a leaf component so the Server Component shell in page.tsx streams
 * instantly without waiting for auth rehydration.
 */
export function BoardsGrid() {
  const { token, isLoading: isAuthLoading } = useAuth();
  const [state, setState] = useState<FetchState>({ status: "idle" });

  useEffect(() => {
    // Wait for the AuthProvider's silent-refresh attempt to finish before
    // deciding whether to fetch or redirect.
    if (isAuthLoading || !token) return;

    // All setState calls happen inside .then() / .catch() callbacks so they
    // are never synchronous within the effect body, satisfying the
    // react-hooks/set-state-in-effect rule.
    fetchBoards(token)
      .then((boards) => setState({ status: "success", boards }))
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        setState({ status: "error", message });
      });
  }, [token, isAuthLoading]);

  // ----- Unauthenticated — derived directly from context, no effect needed -----
  if (!isAuthLoading && !token) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        You must be signed in to view boards.
      </div>
    );
  }

  // ----- Loading -----
  if (state.status === "idle" || state.status === "loading" || isAuthLoading) {
    return (
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        aria-busy="true"
        aria-label="Loading boards"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            className="h-24 animate-pulse rounded-md border border-border bg-muted"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  // ----- Error -----
  if (state.status === "error") {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        {state.message}
      </div>
    );
  }

  // ----- Empty -----
  if (state.boards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You don&apos;t have any boards yet. Create one to get started.
      </p>
    );
  }

  // ----- Success -----
  return (
    <section aria-label="Boards">
      <ul
        className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        aria-label={`${state.boards.length} board${state.boards.length === 1 ? "" : "s"}`}
      >
        {state.boards.map((board) => (
          <li key={board.id}>
            <BoardCard
              title={board.name}
              meta={
                <span className="text-xs text-muted-foreground">
                  {new Date(board.updated_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
