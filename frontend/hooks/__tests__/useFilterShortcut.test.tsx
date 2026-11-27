import { fireEvent, render, screen } from "@testing-library/react";
import { useFilterShortcut } from "@/hooks/useFilterShortcut";

const onTrigger = jest.fn();

function Harness({ children }: { children?: React.ReactNode }) {
  useFilterShortcut(onTrigger);
  return <div>{children}</div>;
}

describe("useFilterShortcut", () => {
  beforeEach(() => onTrigger.mockReset());

  it("triggers on f and prevents the default", () => {
    render(<Harness />);
    const notPrevented = fireEvent.keyDown(document.body, { key: "f" });
    expect(onTrigger).toHaveBeenCalledTimes(1);
    expect(notPrevented).toBe(false);
  });

  it.each([
    ["input", <input key="i" aria-label="x" />],
    ["textarea", <textarea key="t" aria-label="x" />],
    [
      "select",
      <select key="s" aria-label="x">
        <option>1</option>
      </select>,
    ],
  ])("is ignored inside a %s", (_name, element) => {
    render(<Harness>{element}</Harness>);
    fireEvent.keyDown(screen.getByLabelText("x"), { key: "f" });
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it("is ignored inside a contenteditable element", () => {
    render(
      <Harness>
        <div data-testid="ce" contentEditable suppressContentEditableWarning>
          text
        </div>
      </Harness>,
    );
    const el = screen.getByTestId("ce");
    // jsdom does not implement isContentEditable.
    Object.defineProperty(el, "isContentEditable", { value: true });
    fireEvent.keyDown(el, { key: "f" });
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it.each(["ctrlKey", "metaKey", "altKey"])("is ignored with %s", (modifier) => {
    render(<Harness />);
    fireEvent.keyDown(document.body, { key: "f", [modifier]: true });
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it("is ignored for other keys and for key repeat", () => {
    render(<Harness />);
    fireEvent.keyDown(document.body, { key: "g" });
    fireEvent.keyDown(document.body, { key: "f", repeat: true });
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it("is ignored while a modal dialog is open", () => {
    render(
      <Harness>
        <div role="dialog" aria-modal="true">
          dialog
        </div>
      </Harness>,
    );
    fireEvent.keyDown(document.body, { key: "f" });
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it("stops listening after unmount", () => {
    const { unmount } = render(<Harness />);
    unmount();
    fireEvent.keyDown(document.body, { key: "f" });
    expect(onTrigger).not.toHaveBeenCalled();
  });
});
