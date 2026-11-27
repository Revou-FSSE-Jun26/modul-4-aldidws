import { act, renderHook } from "@testing-library/react";
import { useBoardFilters } from "@/hooks/useBoardFilters";

const A = "11111111-1111-4111-8111-111111111111";

const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
let mockSearch = "";
let mockParams = { key: "", value: new URLSearchParams("") };

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/boards/b-1",
  useSearchParams: () => {
    if (mockParams.key !== mockSearch) {
      mockParams = { key: mockSearch, value: new URLSearchParams(mockSearch) };
    }
    return mockParams.value;
  },
}));

describe("useBoardFilters", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReplace.mockReset();
    mockSearch = "";
  });
  afterEach(() => jest.useRealTimers());

  it("starts from the URL and does not write it", () => {
    mockSearch = `q=spec&labels=${A}&due=7d`;
    const valid = [A];
    const { result } = renderHook(() => useBoardFilters(valid));
    expect(result.current.filters).toEqual({
      keyword: "spec",
      labelIds: [A],
      due: "7d",
      priority: "any",
    });
    expect(result.current.activeCount).toBe(3);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("parses priority=high from the URL and counts it", () => {
    mockSearch = "priority=high";
    const valid: string[] = [];
    const { result } = renderHook(() => useBoardFilters(valid));
    expect(result.current.filters).toEqual({
      keyword: "",
      labelIds: [],
      due: "any",
      priority: "high",
    });
    expect(result.current.activeCount).toBe(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("defaults to 'any' when the URL has no priority key", () => {
    mockSearch = "";
    const valid: string[] = [];
    const { result } = renderHook(() => useBoardFilters(valid));
    expect(result.current.filters.priority).toBe("any");
  });

  it("parses due=today from the URL", () => {
    mockSearch = "due=today";
    const valid: string[] = [];
    const { result } = renderHook(() => useBoardFilters(valid));
    expect(result.current.filters.due).toBe("today");
    expect(result.current.activeCount).toBe(1);
  });

  it("makes no router.replace call for a label id while the board labels are not loaded", () => {
    mockSearch = `labels=${A}`;
    const valid: string[] = [];
    const { result } = renderHook(() => useBoardFilters(valid));
    expect(result.current.filters.labelIds).toEqual([]);
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("updates the keyword at once and the URL only after 300 ms", () => {
    const valid: string[] = [];
    const { result } = renderHook(() => useBoardFilters(valid));
    act(() => result.current.setKeyword("a"));
    act(() => {
      jest.advanceTimersByTime(200);
    });
    act(() => result.current.setKeyword("ab"));
    expect(result.current.filters.keyword).toBe("ab");
    expect(result.current.debouncedKeyword).toBe("");

    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(mockReplace).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/boards/b-1?q=ab", { scroll: false });
    expect(result.current.debouncedKeyword).toBe("ab");
  });

  it("writes label and due changes at once and clear removes the keys", () => {
    mockSearch = "utm=1";
    const valid = [A];
    const { result } = renderHook(() => useBoardFilters(valid));
    act(() => result.current.setLabelIds([A]));
    expect(mockReplace).toHaveBeenLastCalledWith(`/boards/b-1?utm=1&labels=${A}`, {
      scroll: false,
    });
    act(() => result.current.setDue("none"));
    expect(mockReplace).toHaveBeenLastCalledWith("/boards/b-1?utm=1&due=none", {
      scroll: false,
    });
    act(() => result.current.clear());
    expect(mockReplace).toHaveBeenLastCalledWith("/boards/b-1?utm=1", { scroll: false });
    expect(result.current.filters.keyword).toBe("");
  });

  it("setPriority writes priority=high to the URL immediately (no debounce)", () => {
    mockSearch = "";
    const valid: string[] = [];
    const { result } = renderHook(() => useBoardFilters(valid));
    act(() => result.current.setPriority("high"));
    // No timer needed — priority is written immediately like setDue
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/boards/b-1?priority=high", { scroll: false });
  });

  it("clear() removes the priority key", () => {
    mockSearch = "priority=low&utm=1";
    const valid: string[] = [];
    const { result } = renderHook(() => useBoardFilters(valid));
    act(() => result.current.clear());
    expect(mockReplace).toHaveBeenLastCalledWith("/boards/b-1?utm=1", { scroll: false });
    expect(result.current.filters.keyword).toBe("");
  });

  it("does not write after unmount", () => {
    const valid: string[] = [];
    const { result, unmount } = renderHook(() => useBoardFilters(valid));
    act(() => result.current.setKeyword("x"));
    unmount();
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
