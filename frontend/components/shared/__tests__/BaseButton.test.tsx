import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BaseButton } from "@/components/shared/BaseButton";

describe("BaseButton", () => {
  it("renders a type=button by default and handles clicks with the event", async () => {
    const onClick = jest.fn();
    render(<BaseButton onClick={onClick}>Save</BaseButton>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("type", "button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0][0]).toHaveProperty("type", "click");
  });

  it("passes aria attributes, id, title and className through", () => {
    render(
      <BaseButton
        aria-label="Delete card"
        aria-expanded={false}
        id="x"
        title="tip"
        className="extra-class"
        size="icon"
      >
        X
      </BaseButton>,
    );
    const button = screen.getByRole("button", { name: "Delete card" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("id", "x");
    expect(button).toHaveAttribute("title", "tip");
    expect(button).toHaveClass("extra-class");
  });

  it("uses a 44px minimum target below the sm breakpoint", () => {
    render(<BaseButton size="sm">Small</BaseButton>);
    expect(screen.getByRole("button", { name: "Small" })).toHaveClass("min-h-11");
  });

  it("does not fire onClick when disabled and supports submit type", async () => {
    const onClick = jest.fn();
    render(
      <BaseButton disabled type="submit" onClick={onClick}>
        Go
      </BaseButton>,
    );
    const button = screen.getByRole("button", { name: "Go" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("type", "submit");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
