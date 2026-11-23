"use client";

import {
  createContext,
  useContext,
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
  /** Always false: nothing async runs on mount (the backend has no refresh endpoint). */
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
  /** Returned by the backend but intentionally not stored anywhere. */
  refresh_token?: string;
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
  // No session restore: the backend has no refresh endpoint, so nothing async
  // runs on mount and auth is never in a loading state.
  const isLoading = false;

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
  }

  // -------------------------------------------------------------------------
  // logout
  // -------------------------------------------------------------------------
  async function logout(): Promise<void> {
    // The backend has no logout endpoint, so this only clears client state.
    // The access token stays valid until it expires.
    setToken(null);
    setCurrentUser(null);
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
