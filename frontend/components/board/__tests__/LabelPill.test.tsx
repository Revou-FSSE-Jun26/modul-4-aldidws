import { render, screen } from "@testing-library/react";
import { LabelPill } from "@/components/board/LabelPill";

describe("LabelPill", () => {
  it("shows the name as text with a title for long names", () => {
    render(<LabelPill name="Needs review" color="orange" />);
    const pill = screen.getByText("Needs review");
    expect(pill).toHaveAttribute("title", "Needs review");
    expect(pill.className).toContain("--label-orange-bg");
    expect(pill.className).toContain("truncate");
  });

  it("uses a different colour class per colour", () => {
    render(
      <>
        <LabelPill name="A" color="red" />
        <LabelPill name="B" color="green" />
      </>,
    );
    expect(screen.getByText("A").className).not.toBe(screen.getByText("B").className);
  });
});
