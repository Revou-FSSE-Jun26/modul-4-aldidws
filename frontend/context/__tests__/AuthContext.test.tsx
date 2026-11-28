import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";

const user = {
  id: "u-1",
  email: "user@example.com",
  name: "Ann",
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

const refreshBody = {
  data: {
    access_token: "refreshed-access-token",
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

function notOkResponse(status: number, code: string) {
  return {
    ok: false,
    status,
    json: async () => ({ error: { code, message: "error" } }),
  };
}

// 204 No Content
function noContentResponse() {
  return { ok: true, status: 204, json: async () => ({}) };
}

describe("AuthProvider", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("attempts a silent refresh on mount (calls /api/auth/refresh)", async () => {
    // Mount resolves isAuthLoading after the refresh attempt settles.
    fetchMock.mockResolvedValueOnce(notOkResponse(401, "MISSING_REFRESH_TOKEN"));

    render(
      <AuthProvider>
        <p>child</p>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/auth\/refresh$/);
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("starts with isAuthLoading true then sets it to false after refresh attempt", async () => {
    fetchMock.mockResolvedValueOnce(notOkResponse(401, "MISSING_REFRESH_TOKEN"));
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Initially loading
    expect(result.current.isAuthLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isAuthLoading).toBe(false);
    });
    expect(result.current.token).toBeNull();
    expect(result.current.currentUser).toBeNull();
  });

  it("restores session when refresh cookie is valid", async () => {
    fetchMock.mockResolvedValueOnce(okResponse(refreshBody));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isAuthLoading).toBe(false);
    });

    expect(result.current.token).toBe("refreshed-access-token");
    expect(result.current.currentUser).toEqual(user);
  });

  it("login sets token and user and stores nothing in web storage", async () => {
    // First call: mount refresh (fails — no cookie), second call: login
    fetchMock
      .mockResolvedValueOnce(notOkResponse(401, "MISSING_REFRESH_TOKEN"))
      .mockResolvedValueOnce(okResponse(loginBody));

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for auth loading to settle
    await waitFor(() => {
      expect(result.current.isAuthLoading).toBe(false);
    });

    await act(async () => {
      await result.current.login("user@example.com", "password");
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/api\/auth\/login$/);
    expect(result.current.token).toBe("dummy-access-token");
    expect(result.current.currentUser).toEqual(user);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("updateProfile merges name and timezone into the in-memory user only", async () => {
    fetchMock
      .mockResolvedValueOnce(notOkResponse(401, "MISSING_REFRESH_TOKEN"))
      .mockResolvedValueOnce(okResponse(loginBody));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isAuthLoading).toBe(false));

    await act(async () => {
      await result.current.login("user@example.com", "password");
    });
    fetchMock.mockClear();

    act(() => {
      result.current.updateProfile({ name: "Bea", timezone: "Asia/Jakarta" });
    });

    expect(result.current.currentUser).toEqual({
      ...user,
      name: "Bea",
      timezone: "Asia/Jakarta",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("login rejects and keeps state empty when credentials are invalid", async () => {
    fetchMock
      .mockResolvedValueOnce(notOkResponse(401, "MISSING_REFRESH_TOKEN"))
      .mockResolvedValueOnce(notOkResponse(401, "INVALID_CREDENTIALS"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isAuthLoading).toBe(false));

    await act(async () => {
      await expect(
        result.current.login("user@example.com", "wrong"),
      ).rejects.toBeDefined();
    });

    expect(result.current.token).toBeNull();
    expect(result.current.currentUser).toBeNull();
  });

  it("logout calls /api/auth/logout and clears state", async () => {
    fetchMock
      .mockResolvedValueOnce(notOkResponse(401, "MISSING_REFRESH_TOKEN"))
      .mockResolvedValueOnce(okResponse(loginBody))
      .mockResolvedValueOnce(noContentResponse()); // logout

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isAuthLoading).toBe(false));

    await act(async () => {
      await result.current.login("user@example.com", "password");
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(fetchMock.mock.calls[2][0]).toMatch(/\/api\/auth\/logout$/);
    expect(result.current.token).toBeNull();
    expect(result.current.currentUser).toBeNull();
  });

  it("logout clears state even when backend call fails", async () => {
    fetchMock
      .mockResolvedValueOnce(notOkResponse(401, "MISSING_REFRESH_TOKEN"))
      .mockResolvedValueOnce(okResponse(loginBody))
      .mockRejectedValueOnce(new Error("Network error")); // logout fails

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isAuthLoading).toBe(false));

    await act(async () => {
      await result.current.login("user@example.com", "password");
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.token).toBeNull();
    expect(result.current.currentUser).toBeNull();
  });
});
