import { getInitials } from "@/lib/initials";

describe("getInitials", () => {
  it("falls back to the email local-part when the name is empty", () => {
    expect(getInitials("", "ann@example.com")).toBe("A");
    expect(getInitials("   ", "bob@example.com")).toBe("B");
    expect(getInitials(null, "carl@example.com")).toBe("C");
  });

  it("uses one letter for a single word", () => {
    expect(getInitials("ann", "x@example.com")).toBe("A");
  });

  it("uses the first two words only", () => {
    expect(getInitials("Ann Bee", "x@example.com")).toBe("AB");
    expect(getInitials("ann bee cee", "x@example.com")).toBe("AB");
  });

  it("ignores extra whitespace", () => {
    expect(getInitials("  Ann    Bee  ", "x@example.com")).toBe("AB");
  });

  it("does not split emoji or other astral characters", () => {
    expect(getInitials("😀 Smile", "x@example.com")).toBe("😀S");
    expect(getInitials("", "😀@example.com")).toBe("😀");
  });

  it("returns an empty string when nothing is available", () => {
    expect(getInitials("", "@example.com")).toBe("");
  });
});
