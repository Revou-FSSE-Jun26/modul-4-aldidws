import { PageHeader } from "@/components/shared/PageHeader";
import { BoardsGrid } from "@/components/board/BoardsGrid";

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col bg-[#FAF9F6]">
      <PageHeader />
      <main className="min-w-0 flex-1 bg-[#FAF9F6]">
        <BoardsGrid />
      </main>
    </div>
  );
}