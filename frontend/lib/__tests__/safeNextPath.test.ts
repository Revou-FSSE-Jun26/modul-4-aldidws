import { safeNextPath } from "@/lib/safeNextPath";

describe("safeNextPath", () => {
  it.each([
    ["/boards/x", "/boards/x"],
    ["/my-tasks?x=1", "/my-tasks?x=1"],
    ["/", "/"],
  ])("accepts %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    "//evil.com",
    "https://evil.com",
    "http://evil.com/x",
    "javascript:alert(1)",
    "/\\evil.com",
    "evil.com",
    "/ok\nHeader: x",
    "",
  ])("rejects %j", (input) => {
    expect(safeNextPath(input)).toBe("/");
  });

  it("falls back to / for null and undefined", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
  });
});
