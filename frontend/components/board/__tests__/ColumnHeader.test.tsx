import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColumnHeader } from "@/components/board/ColumnHeader";

describe("ColumnHeader", () => {
  it("shows the title and the card count badge", () => {
    render(<ColumnHeader title="To Do" cardCount={3} />);
    expect(screen.getByText("To Do")).toBeInTheDocument();
    expect(screen.getByLabelText("3 cards")).toBeInTheDocument();
  });

  it("shows x of y instead of the plain count while filtering", () => {
    render(<ColumnHeader title="To Do" cardCount={1} visibleCount={1} totalCount={4} />);
    expect(screen.getByLabelText("1 of 4 cards shown")).toHaveTextContent("1 of 4");
    expect(screen.queryByLabelText("1 card")).not.toBeInTheDocument();
  });

  it("exposes the status color as data-status on the header", () => {
    render(<ColumnHeader title="To Do" cardCount={3} status="blue" />);

    expect(screen.getByRole("banner")).toHaveAttribute("data-status", "blue");
  });

  it("keeps an accessible count label next to the status", () => {
    render(<ColumnHeader title="To Do" cardCount={3} status="red" />);

    expect(screen.getByLabelText("3 cards")).toHaveTextContent("3");
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

  describe("column actions menu", () => {
    const trigger = () => screen.getByRole("button", { name: "Column actions for To Do" });

    it("calls onColumnDelete from the menu and no standalone delete button exists", async () => {
      const onDelete = jest.fn();
      render(<ColumnHeader title="To Do" cardCount={0} onColumnDelete={onDelete} />);
      expect(screen.queryByRole("button", { name: /Delete column/ })).not.toBeInTheDocument();
      await userEvent.click(trigger());
      await userEvent.click(screen.getByRole("menuitem", { name: "Delete column" }));
      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("exposes haspopup/expanded and opens on click", async () => {
      render(<ColumnHeader title="To Do" cardCount={0} onColumnDelete={jest.fn()} />);
      expect(trigger()).toHaveAttribute("aria-haspopup", "menu");
      expect(trigger()).toHaveAttribute("aria-expanded", "false");
      await userEvent.click(trigger());
      expect(trigger()).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("opens with Enter, Space and ArrowDown and focuses the first item", async () => {
      render(<ColumnHeader title="To Do" cardCount={0} onRename={jest.fn()} onColumnDelete={jest.fn()} />);
      for (const key of ["{Enter}", " ", "{ArrowDown}"]) {
        trigger().focus();
        await userEvent.keyboard(key);
        expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();
        await userEvent.keyboard("{Escape}");
      }
    });

    it("moves with arrows, closes on Escape and returns focus to the trigger", async () => {
      render(<ColumnHeader title="To Do" cardCount={0} onRename={jest.fn()} onColumnDelete={jest.fn()} />);
      trigger().focus();
      await userEvent.keyboard("{ArrowDown}");
      await userEvent.keyboard("{ArrowDown}");
      expect(screen.getByRole("menuitem", { name: "Delete column" })).toHaveFocus();
      await userEvent.keyboard("{ArrowUp}");
      expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();
      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(trigger()).toHaveFocus();
    });

    it("closes on outside click and on Tab", async () => {
      render(<ColumnHeader title="To Do" cardCount={0} onColumnDelete={jest.fn()} />);
      await userEvent.click(trigger());
      await userEvent.click(document.body);
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      await userEvent.click(trigger());
      await userEvent.keyboard("{Tab}");
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("starts the inline rename from the Rename item", async () => {
      render(<ColumnHeader title="To Do" cardCount={0} onRename={jest.fn()} />);
      await userEvent.click(trigger());
      await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
      expect(screen.getByRole("textbox", { name: "Column name" })).toHaveValue("To Do");
    });

    it("marks the current color and reports the chosen one (Automatic gives null)", async () => {
      const onColorChange = jest.fn();
      render(<ColumnHeader title="To Do" cardCount={0} color="blue" onColorChange={onColorChange} />);
      await userEvent.click(trigger());
      expect(screen.getByRole("menuitemradio", { name: "Blue" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("menuitemradio", { name: "Gray" })).toHaveAttribute("aria-checked", "false");
      await userEvent.click(screen.getByRole("menuitemradio", { name: "Orange" }));
      expect(onColorChange).toHaveBeenLastCalledWith("orange");
      await userEvent.click(trigger());
      await userEvent.click(screen.getByRole("menuitemradio", { name: "Automatic" }));
      expect(onColorChange).toHaveBeenLastCalledWith(null);
    });

    it("labels the Done toggle by state and exposes data-done", async () => {
      const onDoneChange = jest.fn();
      const { rerender } = render(<ColumnHeader title="To Do" cardCount={0} onDoneChange={onDoneChange} />);
      expect(screen.getByRole("banner")).toHaveAttribute("data-done", "false");
      await userEvent.click(trigger());
      await userEvent.click(screen.getByRole("menuitem", { name: "Mark as Done column" }));
      expect(onDoneChange).toHaveBeenLastCalledWith(true);
      rerender(<ColumnHeader title="To Do" cardCount={0} isDone onDoneChange={onDoneChange} />);
      expect(screen.getByRole("banner")).toHaveAttribute("data-done", "true");
      await userEvent.click(trigger());
      await userEvent.click(screen.getByRole("menuitem", { name: "Unmark Done column" }));
      expect(onDoneChange).toHaveBeenLastCalledWith(false);
    });

    it("disables color, Done and delete items while actionsDisabled", async () => {
      render(
        <ColumnHeader title="To Do" cardCount={0} actionsDisabled onColorChange={jest.fn()} onDoneChange={jest.fn()} onColumnDelete={jest.fn()} />,
      );
      await userEvent.click(trigger());
      expect(screen.getByRole("menuitem", { name: "Mark as Done column" })).toBeDisabled();
      expect(screen.getByRole("menuitem", { name: "Delete column" })).toBeDisabled();
      expect(screen.getByRole("menuitemradio", { name: "Red" })).toBeDisabled();
    });
  });

  describe("reorder handle", () => {
    function setup() {
      const reorder = { columnId: "c-1", onDragStart: jest.fn(), onDragEnd: jest.fn(), onMove: jest.fn() };
      render(<ColumnHeader title="To Do" cardCount={0} reorder={reorder} />);
      return reorder;
    }

    it("is hidden when no reorder wiring is given", () => {
      render(<ColumnHeader title="To Do" cardCount={0} />);
      expect(screen.queryByRole("button", { name: /Reorder column/ })).not.toBeInTheDocument();
    });

    it("has an accessible name, is draggable and carries the column id", () => {
      setup();
      const handle = screen.getByRole("button", { name: "Reorder column To Do" });
      expect(handle).toHaveAttribute("draggable", "true");
      expect(handle).toHaveAttribute("data-column-handle", "c-1");
    });

    it("starts a drag only from the handle", () => {
      const reorder = setup();
      fireEvent.dragStart(screen.getByRole("button", { name: "To Do" }));
      expect(reorder.onDragStart).not.toHaveBeenCalled();
      fireEvent.dragStart(screen.getByRole("button", { name: "Reorder column To Do" }));
      expect(reorder.onDragStart).toHaveBeenCalledTimes(1);
    });

    it("moves left and right with the arrow keys and ignores other keys", async () => {
      const reorder = setup();
      screen.getByRole("button", { name: "Reorder column To Do" }).focus();
      await userEvent.keyboard("{ArrowLeft}{ArrowRight}{ArrowUp}a");
      expect(reorder.onMove.mock.calls).toEqual([[-1], [1]]);
    });
  });
});
