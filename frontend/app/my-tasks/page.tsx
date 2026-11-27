import { Suspense } from "react";
import { CheckSquare } from "lucide-react";
import { MyTasksList } from "@/components/board/MyTasksList";
import { BoardBgWrapper } from "@/components/board/BoardBgWrapper";
import { PageHeader } from "@/components/shared/PageHeader";

/**
 * My Tasks page — Server Component (no "use client", no useState).
 *
 * The access token is held in memory on the client only, so the authenticated
 * GET /api/v1/cards?mine=true fetch must happen client-side.
 *
 * This page renders the layout shell on the server and mounts <MyTasksList>
 * (a Client Component) inside a Suspense boundary so the shell streams
 * immediately without waiting for auth rehydration or the API call.
 */
export default function MyTasksPage() {
  return (
    <BoardBgWrapper className="flex flex-1 flex-col">
      <PageHeader
        title="My Tasks"
        description="Cards you created, grouped by board."
        icon={<CheckSquare size={16} strokeWidth={1.5} />}
      />
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <Suspense fallback={<MyTasksSkeleton />}>
            <MyTasksList />
          </Suspense>
        </div>
      </main>
    </BoardBgWrapper>
  );
}

/** Skeleton shown while the client-side fetch is in flight. */
function MyTasksSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading tasks">
      {/* Stats skeleton */}
      <div className="h-24 animate-pulse rounded-xl border border-border/50 bg-muted" aria-hidden="true" />
      
      {/* Task groups skeleton */}
      {Array.from({ length: 2 }).map((_, groupIdx) => (
        <div key={groupIdx} className="flex flex-col gap-4" aria-hidden="true">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          {Array.from({ length: 3 }).map((_, cardIdx) => (
            <div
              key={cardIdx}
              className="h-16 animate-pulse rounded-xl border border-border/50 bg-muted"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
