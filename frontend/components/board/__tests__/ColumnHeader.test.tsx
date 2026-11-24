import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColumnHeader } from "@/components/board/ColumnHeader";

describe("ColumnHeader", () => {
  it("shows the title and the card count badge", () => {
    render(<ColumnHeader title="To Do" cardCount={3} />);
    expect(screen.getByText("To Do")).toBeInTheDocument();
    expect(screen.getByLabelText("3 cards")).toBeInTheDocument();
  });

  it("uses the singular for one card", () => {
    render(<ColumnHeader title="To Do" cardCount={1} />);
    expect(screen.getByLabelText("1 card")).toBeInTheDocument();
  });

  it("renames with the trimmed value on Enter", async () => {
    const onRename = jest.fn();
    render(<ColumnHeader title="To Do" cardCount={0} onRename={onRename} />);
    await userEvent.click(screen.getByRole("button", { name: "Rename column: To Do" }));
    const input = screen.getByRole("textbox", { name: "Column name" });
    await userEvent.clear(input);
    await userEvent.type(input, "  Doing {Enter}");
    expect(onRename).toHaveBeenCalledWith("Doing");
  });

  it("does not call onRename when the name is unchanged", async () => {
    const onRename = jest.fn();
    render(<ColumnHeader title="To Do" cardCount={0} onRename={onRename} />);
    await userEvent.click(screen.getByRole("button", { name: "Rename column: To Do" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Column name" }), "{Enter}");
    expect(onRename).not.toHaveBeenCalled();
  });

  it("rejects an empty name and keeps the editor open", async () => {
    const onRename = jest.fn();
    render(<ColumnHeader title="To Do" cardCount={0} onRename={onRename} />);
    await userEvent.click(screen.getByRole("button", { name: "Rename column: To Do" }));
    await userEvent.clear(screen.getByRole("textbox", { name: "Column name" }));
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot be empty/i);
    expect(onRename).not.toHaveBeenCalled();
  });

  it("Escape cancels without renaming", async () => {
    const onRename = jest.fn();
    render(<ColumnHeader title="To Do" cardCount={0} onRename={onRename} />);
    await userEvent.click(screen.getByRole("button", { name: "Rename column: To Do" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Column name" }), "x{Escape}");
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Rename column: To Do" })).toBeInTheDocument();
  });

  it("calls onColumnDelete from the delete button", async () => {
    const onDelete = jest.fn();
    render(<ColumnHeader title="To Do" cardCount={0} onColumnDelete={onDelete} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete column: To Do" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
