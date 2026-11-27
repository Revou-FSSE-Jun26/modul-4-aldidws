import { Suspense } from "react";
import { BoardDetailView } from "@/components/board/BoardDetailView";
import { BoardBgWrapper } from "@/components/board/BoardBgWrapper";

/**
 * Board detail page — Server Component shell.
 *
 * The access token is held in memory on the client only (AuthContext), so the
 * authenticated fetch and the redirect to /login for unauthenticated users
 * happen in the client component <BoardDetailView> after auth has finished
 * loading. `params` is a Promise in this Next.js version.
 */
export default async function BoardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <BoardBgWrapper boardId={id} className="flex flex-1 flex-col">
      <Suspense
        fallback={
          <div className="px-4 py-8 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading board" />
        }
      >
        <BoardDetailView boardId={id} />
      </Suspense>
    </BoardBgWrapper>
  );
}
