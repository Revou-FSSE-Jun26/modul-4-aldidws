"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  timezone: string;
}

interface AuthContextValue {
  currentUser: AuthUser | null;
  /** In-memory access token. NEVER stored in localStorage or sessionStorage. */
  token: string | null;
  /** True while the initial silent-refresh attempt is in progress. */
  isLoading: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  updateProfile(updates: Partial<Pick<AuthUser, "email" | "timezone">>): void;
}

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

interface LoginResponseData {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

interface RefreshResponseData {
  access_token: string;
  user: AuthUser;
}

interface ApiResponse<T> {
  data: T;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // -------------------------------------------------------------------------
  // Silent refresh on mount — restores the session via the httpOnly cookie
  // -------------------------------------------------------------------------
  useEffect(() => {
    async function attemptSilentRefresh() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: "POST",
          credentials: "include", // sends the refresh_token cookie
        });

        if (!response.ok) {
          // 401 or any non-2xx: session cannot be restored; stay logged out
          return;
        }

        const { data }: ApiResponse<RefreshResponseData> = await response.json();
        setToken(data.access_token);
        setCurrentUser(data.user);
      } catch {
        // Network failure: stay logged out silently
      } finally {
        setIsLoading(false);
      }
    }

    void attemptSilentRefresh();
  }, []);

  // -------------------------------------------------------------------------
  // login
  // -------------------------------------------------------------------------
  async function login(email: string, password: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // No credentials: the backend CORS config has supports_credentials=False,
      // so a credentialed cross-origin request would be blocked by the browser.
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorBody: unknown = await response.json().catch(() => null);
      throw errorBody instanceof Object && "error" in errorBody
        ? errorBody
        : new Error(`Login failed with status ${response.status}`);
    }

    const { data }: ApiResponse<LoginResponseData> = await response.json();

    setToken(data.access_token);
    setCurrentUser(data.user);

    // TODO: Once the backend sends Set-Cookie: HttpOnly for refresh_token,
    // remove this client-side cookie write. The backend should set the httpOnly
    // cookie via its Set-Cookie response header instead.
    document.cookie = `refresh_token=${data.refresh_token}; path=/; SameSite=Strict`;
  }

  // -------------------------------------------------------------------------
  // logout
  // -------------------------------------------------------------------------
  async function logout(): Promise<void> {
    // Fire-and-forget: backend endpoint not yet implemented; swallow errors
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      // Intentionally ignored — clear local state regardless
    }

    setToken(null);
    setCurrentUser(null);

    // Clear the refresh token cookie
    document.cookie = "refresh_token=; Max-Age=0; path=/";
  }

  // -------------------------------------------------------------------------
  // updateProfile — optimistic client-side merge, no API call
  // -------------------------------------------------------------------------
  function updateProfile(
    updates: Partial<Pick<AuthUser, "email" | "timezone">>
  ): void {
    if (currentUser === null) return;
    setCurrentUser({ ...currentUser, ...updates });
  }

  return (
    <AuthContext.Provider
      value={{ currentUser, token, isLoading, login, logout, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used inside an <AuthProvider>.");
  }
  return context;
}
