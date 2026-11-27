import { moveItem } from "@/lib/columnOrder";

describe("moveItem", () => {
  const ids = ["a", "b", "c", "d"];

  it("moves an item forward", () => {
    expect(moveItem(ids, 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves an item backward", () => {
    expect(moveItem(ids, 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("returns an equal copy when from equals to", () => {
    const result = moveItem(ids, 1, 1);
    expect(result).toEqual(ids);
    expect(result).not.toBe(ids);
  });

  it("returns an unchanged copy for out-of-range indexes", () => {
    expect(moveItem(ids, -1, 2)).toEqual(ids);
    expect(moveItem(ids, 0, 4)).toEqual(ids);
  });

  it("does not mutate the input", () => {
    moveItem(ids, 0, 3);
    expect(ids).toEqual(["a", "b", "c", "d"]);
  });
});
