import { Suspense } from "react";
import { BoardsGrid } from "@/components/board/BoardsGrid";

/**
 * Home page — Server Component (no "use client").
 *
 * The access token is held in memory on the client only (never in a
 * server-readable cookie), so the authenticated `GET /api/boards` fetch
 * must happen on the client after the AuthProvider rehydrates.
 *
 * This page is a pure Server Component that:
 *   1. Renders the page heading and layout shell on the server.
 *   2. Mounts <BoardsGrid> which is a Client Component that fetches boards
 *      using the in-memory access token supplied by AuthContext.
 *   3. Wraps the grid in a <Suspense> boundary so the shell is never blocked
 *      by the client-side fetch.
 */
export default function HomePage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            My Boards
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All boards you own, in one place.
          </p>
        </header>

        {/*
          Suspense boundary: the shell above is streamed immediately;
          <BoardsGrid> streams in once the client fetch resolves.
        */}
        <Suspense fallback={<BoardsGridSkeleton />}>
          <BoardsGrid />
        </Suspense>
      </div>
    </main>
  );
}

/** Skeleton shown while the client-side boards fetch is in flight. */
function BoardsGridSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      aria-busy="true"
      aria-label="Loading boards"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          // Static skeleton tiles — index as key is acceptable here because
          // the list is never reordered and contains no domain identity.
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className="h-24 animate-pulse rounded-md border border-border bg-muted"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
