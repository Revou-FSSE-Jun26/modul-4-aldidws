"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { listBoards } from "@/lib/services/boardsService";
import { ApiError } from "@/lib/errors";
import { loginPath } from "@/lib/loginPath";
import type { Board } from "@/lib/types/api";
import { BoardCard } from "@/components/board/BoardCard";
import { CreateBoardForm } from "@/components/board/CreateBoardForm";

type FetchState =
  | { status: "idle" }
  | { status: "success"; boards: Board[]; focusId: string | null }
  | { status: "error"; message: string };

/**
 * Fetches `GET /api/boards` with the in-memory access token from AuthContext
 * and renders a responsive grid of boards plus the create-board form.
 *
 * Unauthenticated users are redirected to /login by `useRequireAuth` only
 * after AuthContext has finished loading. An expired token (401) also
 * redirects to /login.
 */
export function BoardsGrid() {
  const router = useRouter();
  const pathname = usePathname();
  const { token, isAuthLoading } = useRequireAuth();
  const [state, setState] = useState<FetchState>({ status: "idle" });

  useEffect(() => {
    if (isAuthLoading || !token) return;

    let cancelled = false;

    listBoards(token)
      .then((boards) => {
        if (!cancelled) setState({ status: "success", boards, focusId: null });
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
            err instanceof ApiError
              ? err.message
              : "Could not load boards. Please try again.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [token, isAuthLoading, router, pathname]);

  const focusId = state.status === "success" ? state.focusId : null;
  useEffect(() => {
    if (focusId) document.getElementById(`board-link-${focusId}`)?.focus();
  }, [focusId]);

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

  const { boards } = state;
  const handleCreated = (board: Board) =>
    setState({ status: "success", boards: [board, ...boards], focusId: board.id });

  return (
    <section aria-label="Boards">
      <CreateBoardForm onCreated={handleCreated} />

      {boards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have any boards yet. Create one to get started.
        </p>
      ) : (
        <ul
          className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          aria-label={`${boards.length} board${boards.length === 1 ? "" : "s"}`}
        >
          {boards.map((board) => (
            <li key={board.id}>
              <BoardCard
                title={board.name}
                href={`/boards/${board.id}`}
                openId={`board-link-${board.id}`}
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
      )}
    </section>
  );
}
