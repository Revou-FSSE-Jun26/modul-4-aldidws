import { BoardsGrid } from "@/components/board/BoardsGrid";

/**
 * Home page — Server Component shell.
 *
 * The access token is held in memory on the client only (AuthContext), so the
 * authenticated fetch and the redirect to /login for unauthenticated users
 * happen in the client component <BoardsGrid> after auth has finished loading.
 */
export default function HomePage() {
  return (
    <main className="flex-1 bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            My Boards
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All boards you own, in one place.
          </p>
        </header>
        <BoardsGrid />
      </div>
    </main>
  );
}
