"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { listCards } from "@/lib/services/cardsService";
import { ApiError } from "@/lib/errors";
import { loginPath } from "@/lib/loginPath";
import type { CardListItem } from "@/lib/types/api";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";

const PER_PAGE = 50;

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: CardListItem[]; page: number; total: number };

interface BoardGroup {
  boardId: string;
  boardName: string;
  cards: CardListItem[];
}

function groupByBoard(items: CardListItem[]): BoardGroup[] {
  const groups = new Map<string, BoardGroup>();
  for (const card of items) {
    const group = groups.get(card.board_id);
    if (group) group.cards.push(card);
    else
      groups.set(card.board_id, {
        boardId: card.board_id,
        boardName: card.board_name,
        cards: [card],
      });
  }
  return [...groups.values()];
}

/**
 * Cards the signed-in user created, grouped by board.
 * Loads GET /api/v1/cards?mine=true with "Load more" paging. Real errors are
 * shown; nothing is silently turned into an empty list.
 */
export function MyTasksList() {
  const router = useRouter();
  const pathname = usePathname();
  const { token, isAuthLoading } = useRequireAuth();
  const [state, setState] = useState<ListState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading || !token) return;
    let cancelled = false;
    listCards(token, { mine: true, page: 1, per_page: PER_PAGE })
      .then(({ data, meta }) => {
        if (!cancelled) {
          setState({ status: "ready", items: data, page: meta.page, total: meta.total });
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
      setMoreError(err instanceof Error ? err.message : "Could not load more tasks.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  if (isAuthLoading || !token || state.status === "loading") {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading tasks">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
             
            key={i}
            className="h-14 animate-pulse rounded-md border border-border bg-muted"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col items-start gap-3">
        <div
          role="alert"
          className="w-full rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
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

  if (state.items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You haven&apos;t created any cards yet.{" "}
        <Link href="/" className="font-medium underline">
          Go to your boards
        </Link>
      </p>
    );
  }

  const groups = groupByBoard(state.items);
  const hasMore = state.page * PER_PAGE < state.total;

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.boardId} aria-label={group.boardName}>
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            <Link href={`/boards/${group.boardId}`} className="hover:underline">
              {group.boardName}
            </Link>
          </h2>
          <ul className="flex list-none flex-col gap-2 p-0">
            {group.cards.map((card) => (
              <li
                key={card.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
              >
                <Link
                  href={`/boards/${card.board_id}`}
                  className="min-w-0 truncate text-sm font-medium text-foreground hover:underline"
                >
                  {card.title}
                </Link>
                <BaseBadge>{card.column_name}</BaseBadge>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {moreError && (
        <p role="alert" className="text-xs text-destructive">
          {moreError}
        </p>
      )}
      {hasMore && (
        <div>
          <BaseButton
            variant="secondary"
            disabled={isLoadingMore}
            onClick={() => void handleLoadMore()}
          >
            {isLoadingMore ? "Loading…" : "Load more"}
          </BaseButton>
        </div>
      )}
    </div>
  );
}
