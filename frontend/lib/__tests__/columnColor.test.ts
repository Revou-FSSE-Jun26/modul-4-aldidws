import { resolveColumnColor } from "@/lib/columnColor";

describe("resolveColumnColor", () => {
  it("returns the stored color regardless of index", () => {
    expect(resolveColumnColor("red", 0)).toBe("red");
  });

  it("cycles gray, blue, orange, green, red by index when no color is stored", () => {
    const got = [0, 1, 2, 3, 4].map((i) => resolveColumnColor(null, i));
    expect(got).toEqual(["gray", "blue", "orange", "green", "red"]);
  });

  it("wraps around after the fifth column", () => {
    expect(resolveColumnColor(null, 5)).toBe("gray");
    expect(resolveColumnColor(null, 7)).toBe("orange");
  });
});
