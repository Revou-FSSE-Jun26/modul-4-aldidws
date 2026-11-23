"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { get } from "@/lib/apiClient";
import { ApiError } from "@/lib/errors";
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

type FetchState =
  | { status: "idle" }
  | { status: "success"; boards: Board[] }
  | { status: "error"; message: string };

/**
 * Fetches `GET /api/boards` with the in-memory access token from AuthContext
 * and renders a responsive grid of <BoardCard> tiles.
 *
 * Unauthenticated users are redirected to /login by `useRequireAuth` only
 * after AuthContext has finished loading. An expired token (401) also
 * redirects to /login.
 */
export function BoardsGrid() {
  const router = useRouter();
  const { token, isAuthLoading } = useRequireAuth();
  const [state, setState] = useState<FetchState>({ status: "idle" });

  useEffect(() => {
    if (isAuthLoading || !token) return;

    let cancelled = false;

    get<Board[]>("/api/boards", { token })
      .then((boards) => {
        if (!cancelled) setState({ status: "success", boards });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.isUnauthorized) {
          router.replace("/login");
          return;
        }
        setState({
          status: "error",
          message:
            err instanceof ApiError
              ? err.message
              : "Could not load boards. Please try again.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [token, isAuthLoading, router]);

  // ----- Loading (auth loading, redirecting to /login, or fetch in flight) -----
  if (isAuthLoading || !token || state.status === "idle") {
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
              onCardClick={() => router.push(`/boards/${board.id}`)}
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
