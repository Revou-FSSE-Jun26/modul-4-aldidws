import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BaseModal } from "@/components/shared/BaseModal";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open it</button>
      <BaseModal isOpen={open} onClose={() => setOpen(false)} title="Edit card">
        <button>First</button>
        <button>Last</button>
      </BaseModal>
    </>
  );
}

describe("BaseModal", () => {
  it("renders nothing when closed and a labelled dialog when open", async () => {
    render(<Harness />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open it" }));
    expect(screen.getByRole("dialog", { name: "Edit card" })).toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the opener", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open it" });
    await userEvent.click(opener);
    expect(screen.getByRole("dialog")).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("closes from the close button and from a backdrop click", async () => {
    const onClose = jest.fn();
    const { container } = render(
      <BaseModal isOpen onClose={onClose} title="T">
        <p>body</p>
      </BaseModal>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Close modal" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(container.firstElementChild as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByText("body"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("traps Tab and Shift+Tab inside the dialog", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open it" }));
    const close = screen.getByRole("button", { name: "Close modal" });
    const last = screen.getByRole("button", { name: "Last" });

    last.focus();
    await userEvent.tab();
    expect(close).toHaveFocus();

    await userEvent.tab({ shift: true });
    expect(last).toHaveFocus();
  });

  it("gives two open modals distinct title ids and links the description", () => {
    render(
      <>
        <BaseModal isOpen onClose={() => {}} title="One" description="About one">
          <p>a</p>
        </BaseModal>
        <BaseModal isOpen onClose={() => {}} title="Two">
          <p>b</p>
        </BaseModal>
      </>,
    );
    const [one, two] = screen.getAllByRole("dialog");
    expect(one.getAttribute("aria-labelledby")).not.toBe(two.getAttribute("aria-labelledby"));
    expect(screen.getByRole("dialog", { name: "One" })).toHaveAccessibleDescription("About one");
    expect(screen.getByRole("dialog", { name: "Two" })).toBeInTheDocument();
  });
});
