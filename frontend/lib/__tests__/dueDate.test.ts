import {
  formatDue,
  getDueState,
  isoToLocalInput,
  localInputToIso,
} from "@/lib/dueDate";

const NOW = new Date("2026-06-15T12:00:00Z");
const HOUR = 60 * 60 * 1000;

describe("getDueState", () => {
  it("returns none for null, undefined, empty and invalid values", () => {
    expect(getDueState(null, NOW)).toBe("none");
    expect(getDueState(undefined, NOW)).toBe("none");
    expect(getDueState("", NOW)).toBe("none");
    expect(getDueState("not a date", NOW)).toBe("none");
  });

  it("is overdue one millisecond in the past", () => {
    expect(getDueState(new Date(NOW.getTime() - 1).toISOString(), NOW)).toBe("overdue");
  });

  it("is soon exactly at now", () => {
    expect(getDueState(NOW.toISOString(), NOW)).toBe("soon");
  });

  it("is soon exactly 24 hours ahead", () => {
    expect(getDueState(new Date(NOW.getTime() + 24 * HOUR).toISOString(), NOW)).toBe("soon");
  });

  it("is upcoming one millisecond after 24 hours", () => {
    expect(getDueState(new Date(NOW.getTime() + 24 * HOUR + 1).toISOString(), NOW)).toBe(
      "upcoming",
    );
  });

  it("does not depend on the offset notation of the input", () => {
    expect(getDueState("2026-06-15T19:00:00+07:00", NOW)).toBe("soon");
  });
});

describe("local input conversion", () => {
  it("round trips an ISO value through the local input format", () => {
    const iso = "2026-12-01T17:00:00Z";
    const local = isoToLocalInput(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(localInputToIso(local)).toBe(iso);
  });

  it("returns an empty string for null or invalid ISO input", () => {
    expect(isoToLocalInput(null)).toBe("");
    expect(isoToLocalInput("garbage")).toBe("");
  });

  it("returns null for an empty or malformed local value", () => {
    expect(localInputToIso("")).toBeNull();
    expect(localInputToIso("2026-12-01")).toBeNull();
    expect(localInputToIso("2026-13-45T99:99")).toBeNull();
  });

  it("returns null outside the years 2000 to 2100", () => {
    expect(localInputToIso("1999-06-15T12:00")).toBeNull();
    expect(localInputToIso("2101-06-15T12:00")).toBeNull();
  });

  it("accepts mid-range values and drops milliseconds and zone offsets", () => {
    const iso = localInputToIso("2050-06-15T12:30");
    expect(iso).toMatch(/^2050-06-15T\d{2}:\d{2}:00Z$/);
  });
});

describe("formatDue", () => {
  it("formats a valid ISO value and is empty otherwise", () => {
    expect(formatDue("2026-12-01T17:00:00Z", "en-US")).toContain("2026");
    expect(formatDue(null)).toBe("");
    expect(formatDue("garbage")).toBe("");
  });

  // B4: "Mon D, YYYY" with no leading zero on the day
  it('formats Nov 5 as "Nov 5, 2026"', () => {
    // 2026-11-05T12:00:00Z is Nov 5 in UTC; in any timezone within ±12 h it stays Nov 4–6.
    // We use UTC noon so local time is virtually certain to be Nov 5 as well.
    expect(formatDue("2026-11-05T12:00:00Z", "en-US")).toBe("Nov 5, 2026");
  });

  it('formats Jan 1 as "Jan 1, 2026"', () => {
    expect(formatDue("2026-01-01T12:00:00Z", "en-US")).toBe("Jan 1, 2026");
  });

  it("returns empty string for null input", () => {
    expect(formatDue(null)).toBe("");
  });

  it("returns empty string for undefined input", () => {
    expect(formatDue(undefined)).toBe("");
  });
});
