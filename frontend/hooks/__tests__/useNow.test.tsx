import { act, renderHook } from "@testing-library/react";
import { useNow } from "@/hooks/useNow";

describe("useNow", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts at the current time and refreshes every minute", () => {
    const { result } = renderHook(() => useNow());
    expect(result.current.toISOString()).toBe("2026-06-15T12:00:00.000Z");

    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(result.current.toISOString()).toBe("2026-06-15T12:01:00.000Z");
  });

  it("clears its interval on unmount", () => {
    const { unmount } = renderHook(() => useNow());
    expect(jest.getTimerCount()).toBe(1);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
