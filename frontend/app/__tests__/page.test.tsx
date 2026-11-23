import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";
import BoardDetailPage from "@/app/boards/[id]/page";

// The pages must not read server cookies; importing next/headers fails the test.
jest.mock("next/headers", () => {
  throw new Error("pages must not import next/headers");
});
jest.mock("@/components/board/BoardsGrid", () => ({
  BoardsGrid: () => <div>boards grid</div>,
}));
jest.mock("@/components/board/BoardDetailView", () => ({
  BoardDetailView: ({ boardId }: { boardId: string }) => (
    <div>board detail {boardId}</div>
  ),
}));

describe("page shells", () => {
  it("home renders the heading and the boards grid", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { name: "My Boards" }),
    ).toBeInTheDocument();
    expect(screen.getByText("boards grid")).toBeInTheDocument();
  });

  it("board detail passes the awaited route id to the view", async () => {
    render(await BoardDetailPage({ params: Promise.resolve({ id: "b-1" }) }));
    expect(screen.getByText("board detail b-1")).toBeInTheDocument();
  });
});
