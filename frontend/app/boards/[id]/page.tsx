import { Suspense } from "react";
import { BoardDetailView } from "@/components/board/BoardDetailView";

export default async function BoardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div
            className="px-4 py-8 sm:px-6 lg:px-8"
            aria-busy="true"
            aria-label="Loading board"
          />
        }
      >
        <BoardDetailView boardId={id} />
      </Suspense>
    </div>
  );
}