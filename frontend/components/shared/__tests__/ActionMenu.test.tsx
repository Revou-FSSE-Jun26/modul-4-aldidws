import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionMenu } from "@/components/shared/ActionMenu";

function renderMenu() {
  const onRename = jest.fn();
  const onDone = jest.fn();
  render(
    <div style={{ overflowX: "auto" }}>
      <ActionMenu
        label="Column actions for To Do"
        items={[
          { id: "rename", label: "Rename", onSelect: onRename },
          { id: "done", label: "Mark as Done column", onSelect: onDone },
        ]}
      />
    </div>,
  );
  return { onRename, onDone };
}

describe("ActionMenu", () => {
  it("runs an item with a real pointer sequence (pointerdown, mousedown, click)", async () => {
    const user = userEvent.setup();
    const { onDone } = renderMenu();
    const trigger = screen.getByRole("button", { name: "Column actions for To Do" });
    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: "Mark as Done column" }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("is fixed to the viewport under the trigger so a scrolling parent cannot clip it", async () => {
    const user = userEvent.setup();
    renderMenu();
    const trigger = screen.getByRole("button", { name: "Column actions for To Do" });
    jest.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      top: 100, bottom: 124, left: 280, right: 304, width: 24, height: 24, x: 280, y: 100,
      toJSON: () => ({}),
    });
    await user.click(trigger);
    const menu = screen.getByRole("menu");
    expect(menu).toHaveClass("fixed");
    expect(menu).toHaveStyle({ top: "124px" });
    expect(menu.style.right).toBe(`${document.documentElement.clientWidth - 304}px`);
  });

  it("closes on a pointer press outside without running any item", async () => {
    const user = userEvent.setup();
    const { onRename, onDone } = renderMenu();
    await user.click(screen.getByRole("button", { name: "Column actions for To Do" }));
    await user.click(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onRename).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});
