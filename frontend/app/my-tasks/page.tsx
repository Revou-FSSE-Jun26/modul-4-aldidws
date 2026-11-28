import { Suspense } from "react";
import { MyTasksList } from "@/components/board/MyTasksList";
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
    <div className="flex min-h-screen flex-1 flex-col bg-[#FAF9F6] text-[#1A2E26]">
      <PageHeader
        parent={{ label: "Workspace", href: "/" }}
        title="My Tasks"
      />
      <main className="flex w-full flex-1 flex-col px-6 pt-5 pb-4">
        <div className="flex w-full flex-1 flex-col">
          <Suspense fallback={<MyTasksSkeleton />}>
            <MyTasksList />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

/** Skeleton shown while the client-side fetch is in flight. */
function MyTasksSkeleton() {
  return (
    <div
      className="flex flex-col gap-5"
      aria-busy="true"
      aria-label="Loading tasks"
    >
      {/* Hero banner skeleton */}
      <div
        className="h-36 animate-pulse rounded-2xl bg-[#DCE5CC]/70"
        aria-hidden="true"
      />

      {/* Tabs & toolbar skeleton */}
      <div className="h-9 w-64 animate-pulse rounded-lg bg-[#EAECE6]" aria-hidden="true" />
      <div className="h-9 w-full animate-pulse rounded-lg bg-[#EAECE6]/80" aria-hidden="true" />

      {/* Task rows skeleton */}
      {Array.from({ length: 2 }).map((_, groupIdx) => (
        <div
          key={groupIdx}
          className="flex flex-col gap-2"
          aria-hidden="true"
        >
          <div className="h-5 w-32 animate-pulse rounded bg-[#EAECE6]" />
          {Array.from({ length: 3 }).map((__, cardIdx) => (
            <div
              key={cardIdx}
              className="h-11 animate-pulse rounded-lg border border-[#ECEEE9] bg-white"
            />
          ))}
        </div>
      ))}
    </div>
  );
}