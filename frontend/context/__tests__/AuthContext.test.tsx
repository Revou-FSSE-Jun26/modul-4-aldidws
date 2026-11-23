import { act, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";

const user = {
  id: "u-1",
  email: "user@example.com",
  role: "member",
  timezone: "UTC",
};

const loginBody = {
  data: {
    access_token: "dummy-access-token",
    refresh_token: "dummy-refresh-token",
    user,
  },
};

const fetchMock = jest.fn();

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

describe("AuthProvider", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("does not call fetch on mount", () => {
    render(
      <AuthProvider>
        <p>child</p>
      </AuthProvider>,
    );
    expect(screen.getByText("child")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts logged out with isLoading false", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.token).toBeNull();
    expect(result.current.currentUser).toBeNull();
  });

  it("login sets token and user and stores nothing in cookies or web storage", async () => {
    fetchMock.mockResolvedValue(okResponse(loginBody));
    const cookieBefore = document.cookie;
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login("user@example.com", "password");
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/auth\/login$/);
    expect(result.current.token).toBe("dummy-access-token");
    expect(result.current.currentUser).toEqual(user);
    expect(result.current.isLoading).toBe(false);
    expect(document.cookie).toBe(cookieBefore);
    expect(document.cookie).not.toContain("refresh_token");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("login rejects and keeps state empty when credentials are invalid", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: "UNAUTHORIZED" } }),
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await expect(
        result.current.login("user@example.com", "wrong"),
      ).rejects.toBeDefined();
    });

    expect(result.current.token).toBeNull();
    expect(result.current.currentUser).toBeNull();
  });

  it("logout clears state and makes no network request or cookie write", async () => {
    fetchMock.mockResolvedValue(okResponse(loginBody));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login("user@example.com", "password");
    });
    fetchMock.mockClear();
    const cookieBefore = document.cookie;

    await act(async () => {
      await result.current.logout();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.token).toBeNull();
    expect(result.current.currentUser).toBeNull();
    expect(document.cookie).toBe(cookieBefore);
  });
});
