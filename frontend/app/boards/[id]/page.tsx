import { Suspense } from "react";
import { BoardDetailView } from "@/components/board/BoardDetailView";

/**
 * Board detail page — Server Component (no "use client").
 *
 * The access token is held in memory on the client only, so all authenticated
 * API calls must happen in client components after AuthProvider rehydrates.
 *
 * This page renders the layout shell on the server and mounts
 * <BoardDetailView> (a Client Component) which handles:
 *   - GET /api/boards/<id>          — board name and metadata
 *   - GET /api/boards/<id>/columns  — ordered column list (not yet implemented
 *                                     on backend; BoardDetailView shows a
 *                                     placeholder until the endpoint exists)
 *
 * The <Suspense> boundary lets the shell stream immediately without blocking
 * on the client-side fetch.
 */
export default function BoardDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <Suspense fallback={<BoardDetailSkeleton />}>
        <BoardDetailView boardId={params.id} />
      </Suspense>
    </main>
  );
}

/** Skeleton shown while the client-side board fetch is in flight. */
function BoardDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Board title skeleton */}
      <div className="h-7 w-48 animate-pulse rounded-md bg-muted" aria-hidden="true" />

      {/* Column skeletons */}
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
