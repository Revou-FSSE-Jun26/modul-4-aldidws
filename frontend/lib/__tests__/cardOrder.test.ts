import { computeCardOrder } from "@/lib/cardOrder";

const cards = [
  { id: "a", order: 0 },
  { id: "b", order: 1 },
  { id: "c", order: 2 },
];

describe("computeCardOrder", () => {
  it("returns 0 for an empty column", () => {
    expect(computeCardOrder([], 0)).toBe(0);
    expect(computeCardOrder([], 5)).toBe(0);
  });

  it("halves the first order when inserting at the top and it is positive", () => {
    expect(computeCardOrder([{ id: "a", order: 4 }], 0)).toBe(2);
  });

  it("returns 0 (never negative) when the first card already has order 0", () => {
    expect(computeCardOrder(cards, 0)).toBe(0);
    expect(computeCardOrder([{ id: "a", order: -3 }], 0)).toBe(0);
  });

  it("returns last + 1 when appending", () => {
    expect(computeCardOrder(cards, 3)).toBe(3);
    expect(computeCardOrder(cards, 99)).toBe(3);
  });

  it("returns the midpoint between neighbours", () => {
    expect(computeCardOrder(cards, 1)).toBe(0.5);
    expect(computeCardOrder(cards, 2)).toBe(1.5);
  });

  it("ignores the moving card for a same-column reorder", () => {
    // Moving "a" to index 1 of [b, c]: lands between b (1) and c (2).
    expect(computeCardOrder(cards, 1, "a")).toBe(1.5);
    // Moving "c" to the end of [a, b]: last + 1.
    expect(computeCardOrder(cards, 2, "c")).toBe(2);
    // Moving "b" to the top of [a, c]: first is 0, so 0.
    expect(computeCardOrder(cards, 0, "b")).toBe(0);
  });

  it("does not mutate the input", () => {
    const copy = cards.map((c) => ({ ...c }));
    computeCardOrder(cards, 1, "a");
    expect(cards).toEqual(copy);
  });
});
