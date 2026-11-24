import { render, screen } from "@testing-library/react";
import { BaseBadge } from "@/components/shared/BaseBadge";

describe("BaseBadge", () => {
  it("renders its children with the default variant", () => {
    render(<BaseBadge>Owner</BaseBadge>);
    expect(screen.getByText("Owner")).toHaveClass("bg-gray-100");
  });

  it("applies the chosen variant and extra className", () => {
    render(
      <BaseBadge variant="danger" className="extra">
        3
      </BaseBadge>,
    );
    const badge = screen.getByText("3");
    expect(badge).toHaveClass("bg-red-100", "extra");
  });

  it("passes aria attributes through", () => {
    render(<BaseBadge aria-label="3 cards">3</BaseBadge>);
    expect(screen.getByLabelText("3 cards")).toBeInTheDocument();
  });
});
