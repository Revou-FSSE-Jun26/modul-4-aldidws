import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LabelPicker } from "@/components/board/LabelPicker";
import { BaseModal } from "@/components/shared/BaseModal";
import { ApiError } from "@/lib/errors";
import type { Label } from "@/lib/types/api";

const stamp = "2026-01-01T00:00:00Z";
const labels: Label[] = [
  { id: "l-1", board_id: "b-1", name: "Bug", color: "red", created_at: stamp, updated_at: stamp },
  { id: "l-2", board_id: "b-1", name: "Docs", color: "blue", created_at: stamp, updated_at: stamp },
  { id: "l-3", board_id: "b-1", name: "Idea", color: "green", created_at: stamp, updated_at: stamp },
];

async function openPicker() {
  await userEvent.click(screen.getByRole("button", { name: "Labels" }));
  return screen.getByRole("listbox", { name: "Labels" });
}

describe("LabelPicker", () => {
  it("shows the attached labels as pills and has a collapsed button", () => {
    render(<LabelPicker labels={labels} selectedIds={["l-2"]} onApply={jest.fn()} />);
    const button = screen.getByRole("button", { name: "Labels" });
    expect(button).toHaveAttribute("aria-haspopup", "listbox");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Docs")).toBeInTheDocument();
    expect(screen.queryByText("Bug")).toBeNull();
  });

  it("lists every label as an option with its selected state", async () => {
    render(<LabelPicker labels={labels} selectedIds={["l-2"]} onApply={jest.fn()} />);
    const list = await openPicker();
    expect(list).toHaveAttribute("aria-multiselectable", "true");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options.map((o) => o.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
    expect(screen.getByText("Red")).toBeInTheDocument();
  });

  it("toggles with the keyboard and sends exactly {label_ids} in board order on Apply", async () => {
    const onApply = jest.fn().mockResolvedValue(undefined);
    render(<LabelPicker labels={labels} selectedIds={[]} onApply={onApply} />);
    const list = await openPicker();
    expect(list).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}{ }"); // Docs
    await userEvent.keyboard("{End}{Enter}"); // Idea
    await userEvent.keyboard("{Home} "); // Bug
    expect(screen.getAllByRole("option").map((o) => o.getAttribute("aria-selected"))).toEqual([
      "true",
      "true",
      "true",
    ]);
    await userEvent.keyboard("{ArrowDown}{ }"); // untoggle Docs
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onApply).toHaveBeenCalledWith(["l-1", "l-3"]));
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Labels" })).toHaveFocus();
  });

  it("Escape closes without sending, returns focus and keeps the surrounding dialog open", async () => {
    const onApply = jest.fn();
    const onClose = jest.fn();
    render(
      <BaseModal isOpen onClose={onClose} title="Card">
        <LabelPicker labels={labels} selectedIds={[]} onApply={onApply} />
      </BaseModal>,
    );
    await openPicker();
    await userEvent.keyboard(" ");
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Labels" })).toHaveFocus();
  });

  it("keeps the panel open with an alert when the request fails", async () => {
    const onApply = jest
      .fn()
      .mockRejectedValue(new ApiError(500, "Server exploded", "INTERNAL_ERROR"));
    render(<LabelPicker labels={labels} selectedIds={[]} onApply={onApply} />);
    await openPicker();
    await userEvent.keyboard(" ");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Server exploded");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
  });

  it("explains a 404 as a deleted label", async () => {
    const onApply = jest.fn().mockRejectedValue(new ApiError(404, "Label not found", "LABEL_NOT_FOUND"));
    render(<LabelPicker labels={labels} selectedIds={[]} onApply={onApply} />);
    await openPicker();
    await userEvent.keyboard(" ");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That label no longer exists.");
  });

  it("tells the user when the board has no labels", async () => {
    render(<LabelPicker labels={[]} selectedIds={[]} onApply={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Labels" }));
    expect(screen.getByText(/no labels yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });
});
