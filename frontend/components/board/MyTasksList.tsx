"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { BaseButton } from "@/components/shared/BaseButton";

// ---------------------------------------------------------------------------
// Domain types — mirrors backend card serialisation shape
// ---------------------------------------------------------------------------

interface AssignedCard {
  id: string;
  title: string;
  description: string | null;
  position: number;
  column_id: string;
  /** Board name, returned when the endpoint supports it. */
  board_name?: string | null;
  /** Board id, used to build the navigation link. */
  board_id?: string | null;
  created_at: string;
  updated_at: string;
}

interface CardGroup {
  boardName: string;
  boardId: string | null;
  cards: AssignedCard[];
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

async function fetchAssignedCards(token: string): Promise<AssignedCard[]> {
  // GET /api/cards?assignee=me is not yet implemented on the backend.
  // The cards blueprint currently exposes only POST (create), PATCH (update),
  // DELETE, and PATCH /position.  When the listing endpoint ships it should
  // return { data: AssignedCard[] }.
  //
  // Until then we treat 404/405 as an empty list so the page renders
  // gracefully with an informative empty state.
  const res = await fetch(`${API_BASE}/api/cards?assignee=me`, {
    headers: { Authorization: `Bearer ${token}` },
    // Per frontend.md §7.3: opt out of caching for authenticated user data.
    cache: "no-store",
  });

  if (res.status === 404 || res.status === 405) return [];
  if (!res.ok) throw new Error(`Failed to fetch tasks (${res.status})`);

  const json = (await res.json()) as { data: AssignedCard[] };
  return json.data;
}

/**
 * Group an array of cards by their board name.
 * Cards with no `board_name` fall into an "Unassigned board" bucket.
 * Within each group cards are sorted by `position` ascending.
 */
function groupByBoard(cards: AssignedCard[]): CardGroup[] {
  const map = new Map<string, CardGroup>();

  for (const card of cards) {
    const boardName = card.board_name ?? "Unassigned board";
    const boardId = card.board_id ?? null;
    const key = boardId ?? boardName;

    if (!map.has(key)) {
      map.set(key, { boardName, boardId, cards: [] });
    }
    map.get(key)!.cards.push(card);
  }

  // Sort cards within each group by position
  for (const group of map.values()) {
    group.cards.sort((a, b) => a.position - b.position);
  }

  // Sort groups alphabetically by board name
  return Array.from(map.values()).sort((a, b) =>
    a.boardName.localeCompare(b.boardName),
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A single card row inside a board group. */
function TaskRow({ card }: { card: AssignedCard }) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-md border border-border bg-card px-4 py-3">
      <span className="min-w-0 truncate text-sm font-medium text-foreground">
        {card.title}
      </span>
    </li>
  );
}

/** A named group of cards belonging to one board. */
function BoardGroup({ group }: { group: CardGroup }) {
  return (
    <section aria-label={group.boardName}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {group.boardName}
        </h2>
        {group.boardId && (
          <Link
            href={`/boards/${group.boardId}`}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open board
          </Link>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {group.cards.map((card) => (
          <TaskRow key={card.id} card={card} />
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; groups: CardGroup[] }
  | { status: "error"; message: string };

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Fetches cards assigned to the current user and renders them in a flat list
 * grouped by board name.
 *
 * Uses `"use client"` because it consumes AuthContext and manages local state.
 * BaseButton is used for the empty-state CTA ("Go to Boards").
 */
export function MyTasksList() {
  const { token, isLoading: isAuthLoading } = useAuth();
  const [state, setState] = useState<FetchState>({ status: "idle" });

  useEffect(() => {
    if (isAuthLoading || !token) return;

    // All setState calls happen inside .then() / .catch() callbacks so they
    // are never synchronous within the effect body, satisfying the
    // react-hooks/set-state-in-effect rule.
    fetchAssignedCards(token)
      .then((cards) =>
        setState({ status: "success", groups: groupByBoard(cards) }),
      )
      .catch((err: unknown) =>
        setState({
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "An unexpected error occurred.",
        }),
      );
  }, [token, isAuthLoading]);

  // ----- Unauthenticated — derived directly from context, no effect needed -----
  if (!isAuthLoading && !token) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        You must be signed in to view your tasks.
      </div>
    );
  }

  // ----- Loading -----
  if (state.status === "idle" || state.status === "loading" || isAuthLoading) {
    return (
      <div
        className="flex flex-col gap-6"
        aria-busy="true"
        aria-label="Loading tasks"
      >
        {Array.from({ length: 2 }).map((_, groupIdx) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={groupIdx}
            className="flex flex-col gap-3"
            aria-hidden="true"
          >
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            {Array.from({ length: 3 }).map((_, cardIdx) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={cardIdx}
                className="h-14 animate-pulse rounded-md border border-border bg-muted"
              />
            ))}
          </div>
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
  if (state.groups.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-sm text-muted-foreground">
          No tasks are assigned to you yet.
        </p>
        {/* BaseButton used as a CTA — wraps a Link via the onClick pattern
            since BaseButton exposes an onClick prop.  Using an <a> inside
            a <button> is invalid HTML, so we render the Link separately and
            style it to match the button appearance. */}
        <Link
          href="/"
          className={[
            "inline-flex items-center justify-center rounded-md px-4 py-2",
            "text-sm font-medium",
            "bg-blue-600 text-white",
            "hover:bg-blue-700",
            "transition-colors duration-150",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500",
          ].join(" ")}
        >
          Go to Boards
        </Link>
      </div>
    );
  }

  // ----- Success -----
  return (
    <div className="flex flex-col gap-8">
      {state.groups.map((group) => (
        <BoardGroup key={group.boardId ?? group.boardName} group={group} />
      ))}
    </div>
  );
}
