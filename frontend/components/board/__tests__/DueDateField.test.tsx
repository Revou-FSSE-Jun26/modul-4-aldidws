import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DueDateField } from "@/components/board/DueDateField";
import { isoToLocalInput } from "@/lib/dueDate";

function setup(value: string | null = null, overrides: Partial<{ onSave: jest.Mock; onRemove: jest.Mock }> = {}) {
  const onSave = overrides.onSave ?? jest.fn().mockResolvedValue(undefined);
  const onRemove = overrides.onRemove ?? jest.fn().mockResolvedValue(undefined);
  render(<DueDateField value={value} onSave={onSave} onRemove={onRemove} />);
  return { onSave, onRemove };
}

describe("DueDateField", () => {
  it("has a labelled input and disabled actions when empty", () => {
    setup();
    expect(screen.getByLabelText("Due date")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save due date" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove due date" })).toBeDisabled();
  });

  it("saves the typed value as a UTC ISO string", async () => {
    const { onSave } = setup();
    await userEvent.type(screen.getByLabelText("Due date"), "2030-05-06T07:08");
    await userEvent.click(screen.getByRole("button", { name: "Save due date" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toBe(new Date("2030-05-06T07:08").toISOString().slice(0, 19) + "Z");
  });

  it("shows the stored value in local time and disables Save until it changes", () => {
    setup("2030-05-06T07:08:00Z");
    expect(screen.getByLabelText("Due date")).toHaveValue(isoToLocalInput("2030-05-06T07:08:00Z"));
    expect(screen.getByRole("button", { name: "Save due date" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove due date" })).toBeEnabled();
  });

  it("calls onRemove from the Remove due date button", async () => {
    const { onRemove, onSave } = setup("2030-05-06T07:08:00Z");
    await userEvent.click(screen.getByRole("button", { name: "Remove due date" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows the error in an alert and keeps the typed value when saving fails", async () => {
    const onSave = jest.fn().mockRejectedValue(new Error("Server said no"));
    setup(null, { onSave });
    const input = screen.getByLabelText("Due date");
    await userEvent.type(input, "2030-05-06T07:08");
    await userEvent.click(screen.getByRole("button", { name: "Save due date" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Server said no");
    expect(input).toHaveValue("2030-05-06T07:08");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("rejects a year outside 2000 to 2100 without calling onSave", async () => {
    const { onSave } = setup();
    await userEvent.type(screen.getByLabelText("Due date"), "1990-05-06T07:08");
    await userEvent.click(screen.getByRole("button", { name: "Save due date" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/between the years 2000 and 2100/);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows an error when removing fails", async () => {
    const onRemove = jest.fn().mockRejectedValue(new Error("Remove failed"));
    setup("2030-05-06T07:08:00Z", { onRemove });
    await userEvent.click(screen.getByRole("button", { name: "Remove due date" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Remove failed");
  });
});
