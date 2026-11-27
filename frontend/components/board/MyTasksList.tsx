"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CheckSquare } from "lucide-react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { listCards } from "@/lib/services/cardsService";
import { ApiError } from "@/lib/errors";
import { loginPath } from "@/lib/loginPath";
import type { CardListItem } from "@/lib/types/api";
import { useNow } from "@/hooks/useNow";
import { DueDateBadge } from "@/components/board/DueDateBadge";
import { LabelPill } from "@/components/board/LabelPill";
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
  const now = useNow();
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
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/50 bg-muted/20 px-6 py-16 text-center">
        <CheckSquare className="mb-4 h-12 w-12 text-muted-foreground/40" />
        <h3 className="mb-2 text-base font-semibold text-foreground">No tasks yet</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          You haven&apos;t created any cards yet.{" "}
          <Link href="/" className="font-medium text-primary underline hover:text-primary/80">
            Go to your boards
          </Link>{" "}
          to get started.
        </p>
      </div>
    );
  }

  const groups = groupByBoard(state.items);
  const hasMore = state.page * PER_PAGE < state.total;

  return (
    <div className="flex flex-col gap-8">
      {/* Stats card */}
      <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5">
            <CheckSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{state.total}</p>
            <p className="text-sm text-muted-foreground">
              {state.total === 1 ? "task" : "tasks"} created by you
            </p>
          </div>
        </div>
      </div>

      {/* Task groups */}
      <div className="flex flex-col gap-8">
        {groups.map((group) => (
          <section key={group.boardId} aria-label={group.boardName} className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">
                <Link 
                  href={`/boards/${group.boardId}`} 
                  className="hover:text-primary transition-colors hover:underline"
                >
                  {group.boardName}
                </Link>
              </h2>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {group.cards.length}
              </span>
            </div>
            <ul className="flex list-none flex-col gap-3 p-0">
              {group.cards.map((card) => (
                <li
                  key={card.id}
                  className="group flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm px-4 py-3.5 transition-all hover:border-border hover:bg-card hover:shadow-sm"
                >
                  <Link
                    href={`/boards/${card.board_id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary"
                  >
                    {card.title}
                  </Link>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {card.labels?.map((label) => (
                      <LabelPill key={label.id} name={label.name} color={label.color} />
                    ))}
                    <DueDateBadge dueDate={card.due_date} now={now} />
                    <BaseBadge>{card.column_name}</BaseBadge>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {moreError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p role="alert" className="text-sm text-destructive">
            {moreError}
          </p>
        </div>
      )}
      {hasMore && (
        <div className="flex justify-center">
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
  );
}
