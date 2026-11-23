import { BoardDetailView } from "@/components/board/BoardDetailView";

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
    <main className="flex min-h-screen flex-col bg-background">
      <BoardDetailView boardId={id} />
    </main>
  );
}
