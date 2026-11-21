import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { get } from "@/lib/apiClient";
import { ApiError } from "@/lib/errors";
import { ColumnHeader } from "@/components/board/ColumnHeader";
import { BoardCard } from "@/components/board/BoardCard";

// This page reads the `access_token` cookie on every request, so it must
// opt out of static prerendering. `force-dynamic` tells Next.js to always
// render this route at request time.
export const dynamic = "force-dynamic";

/**
 * Board detail page — Server Component (no "use client", no useAuth).
 *
 * Reads the JWT access token from the `access_token` httpOnly cookie and
 * calls GET /api/boards/<id> directly on the server.  The board name and
 * any available column/card data are rendered as part of the initial HTML
 * stream — no client-side fetch waterfall.
 *
 * Cookie prerequisite: same as app/page.tsx — see that file for details.
 *
 * Error handling:
 *   401 → redirect to /login
 *   404 → notFound() (renders the nearest not-found.tsx boundary)
 *   Other errors → render an inline error message
 */

interface Card {
  id: string;
  title: string;
  position: number;
}

interface Column {
  id: string;
  name: string;
  position: number;
  cards: Card[];
}

interface BoardDetail {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  /** Columns with their cards, if the endpoint supports it. */
  columns?: Column[];
}

// ---------------------------------------------------------------------------
// Skeleton — shown by Suspense while async segments stream in
// ---------------------------------------------------------------------------

function BoardDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-7 w-48 animate-pulse rounded-md bg-muted" aria-hidden="true" />
      <div className="flex gap-4 overflow-x-auto pb-4" aria-busy="true" aria-label="Loading board">
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner async component — allows Suspense to stream the shell first
// ---------------------------------------------------------------------------

async function BoardContent({ id, token }: { id: string; token: string }) {
  let board: BoardDetail;

  try {
    board = await get<BoardDetail>(`/api/boards/${id}`, { token });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.isUnauthorized) redirect("/login");
      if (err.isNotFound) notFound();
    }
    // Other errors — render inline message rather than crash the page.
    return (
      <div
        role="alert"
        className="px-4 py-8 sm:px-6 lg:px-8 text-sm text-destructive"
      >
        Failed to load board. Please try refreshing the page.
      </div>
    );
  }

  const columns = board.columns ?? [];

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
          {columns
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((col) => (
              <section
                key={col.id}
                role="listitem"
                aria-label={col.name}
                className="flex w-64 shrink-0 flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3"
              >
                <ColumnHeader title={col.name} cardCount={col.cards.length} />

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

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

export default async function BoardDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value ?? null;

  if (!token) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <Suspense fallback={<BoardDetailSkeleton />}>
        {/* BoardContent is an async Server Component — Suspense streams the
            skeleton until the fetch completes and this segment resolves. */}
        <BoardContent id={params.id} token={token} />
      </Suspense>
    </main>
  );
}
