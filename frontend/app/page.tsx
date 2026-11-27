import { LayoutDashboard } from "lucide-react";
import { BoardsGrid } from "@/components/board/BoardsGrid";
import { BoardBgWrapper } from "@/components/board/BoardBgWrapper";
import { PageHeader } from "@/components/shared/PageHeader";

/**
 * Home page — Server Component shell.
 *
 * The access token is held in memory on the client only (AuthContext), so the
 * authenticated fetch and the redirect to /login for unauthenticated users
 * happen in the client component <BoardsGrid> after auth has finished loading.
 */
export default function HomePage() {
  return (
    <BoardBgWrapper className="flex flex-1 flex-col">
      <PageHeader
        title="My Boards"
        description="All boards you own, in one place."
        icon={<LayoutDashboard size={16} strokeWidth={1.5} />}
      />
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <BoardsGrid />
        </div>
      </main>
    </BoardBgWrapper>
  );
}
