import { Suspense } from "react";
import { MyTasksList } from "@/components/board/MyTasksList";

/**
 * My Tasks page — Server Component (no "use client", no useState).
 *
 * The access token is held in memory on the client only, so the authenticated
 * GET /api/cards?assignee=me fetch must happen client-side after AuthProvider
 * rehydrates.
 *
 * This page renders the layout shell on the server and mounts <MyTasksList>
 * (a Client Component) inside a Suspense boundary so the shell streams
 * immediately without waiting for auth rehydration or the API call.
 */
export default function MyTasksPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            My Tasks
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All cards assigned to you, grouped by board.
          </p>
        </header>

        <Suspense fallback={<MyTasksSkeleton />}>
          <MyTasksList />
        </Suspense>
      </div>
    </main>
  );
}

/** Skeleton shown while the client-side fetch is in flight. */
function MyTasksSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading tasks">
      {Array.from({ length: 2 }).map((_, groupIdx) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={groupIdx}
          className="flex flex-col gap-3"
          aria-hidden="true"
        >
          {/* Group heading skeleton */}
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          {/* Card row skeletons */}
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
