import { parseFilterParams, toSearchParams } from "@/lib/filterParams";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

const parse = (query: string, valid: string[] = [A, B]) =>
  parseFilterParams(new URLSearchParams(query), valid);

describe("parseFilterParams", () => {
  it("returns empty filters for an empty query", () => {
    expect(parse("")).toEqual({ keyword: "", labelIds: [], due: "any", priority: "any" });
  });

  it("reads q, labels, due and priority", () => {
    expect(parse(`q=spec&labels=${A},${B}&due=7d&priority=high`)).toEqual({
      keyword: "spec",
      labelIds: [A, B],
      due: "7d",
      priority: "high",
    });
  });

  it("parses due=today and ignores an invalid priority", () => {
    expect(parse("due=today").due).toBe("today");
    expect(parse("priority=bogus").priority).toBe("any");
    expect(parse("priority=medium").priority).toBe("medium");
  });

  it("trims q and cuts it to 100 characters", () => {
    expect(parse(`q=${"x".repeat(150)}`).keyword).toBe("x".repeat(100));
    expect(parse("q=%20%20hello%20").keyword).toBe("hello");
  });

  it("drops labels that are not UUIDs, unknown to the board or repeated", () => {
    const unknown = "33333333-3333-4333-8333-333333333333";
    expect(parse(`labels=${A},bad,${unknown},${A}`).labelIds).toEqual([A]);
  });

  it("keeps no label while the board labels are not loaded", () => {
    expect(parse(`labels=${A}`, []).labelIds).toEqual([]);
  });

  it("keeps at most 20 labels", () => {
    const ids = Array.from(
      { length: 25 },
      (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`,
    );
    expect(parse(`labels=${ids.join(",")}`, ids).labelIds).toHaveLength(20);
  });

  it("ignores an invalid due value, including the default 'any'", () => {
    expect(parse("due=bogus").due).toBe("any");
    expect(parse("due=any").due).toBe("any");
  });
});

describe("toSearchParams", () => {
  it("writes no keys for empty filters and keeps other keys", () => {
    const out = toSearchParams(
      { keyword: "", labelIds: [], due: "any", priority: "any" },
      new URLSearchParams(`q=old&labels=${A}&due=7d&priority=high&utm=1`),
    );
    expect(out.toString()).toBe("utm=1");
  });

  it("writes all filter keys including priority", () => {
    const out = toSearchParams(
      { keyword: "spec", labelIds: [A, B], due: "overdue", priority: "low" },
      new URLSearchParams(""),
    );
    expect(out.get("q")).toBe("spec");
    expect(out.get("labels")).toBe(`${A},${B}`);
    expect(out.get("due")).toBe("overdue");
    expect(out.get("priority")).toBe("low");
  });

  it("round-trips through parseFilterParams", () => {
    const filters = { keyword: "a b&c", labelIds: [A], due: "24h" as const, priority: "any" as const };
    const out = toSearchParams(filters, new URLSearchParams(""));
    expect(parse(out.toString())).toEqual(filters);
  });
});
