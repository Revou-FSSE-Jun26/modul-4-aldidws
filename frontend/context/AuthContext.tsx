"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { login as loginRequest } from "@/lib/services/authService";
import { apiClient } from "@/lib/apiClient";
import { apiPaths } from "@/lib/apiPaths";
import type { User, LoginResult } from "@/lib/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuthUser = User;

interface AuthContextValue {
  currentUser: AuthUser | null;
  /** In-memory access token. NEVER stored in localStorage or sessionStorage. */
  token: string | null;
  /**
   * True while AuthContext is performing the initial silent refresh on mount.
   * useRequireAuth waits for this to be false before redirecting to /login.
   */
  isAuthLoading: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  /** Merges server-confirmed profile fields into the in-memory user. */
  updateProfile(updates: Partial<Pick<AuthUser, "name" | "timezone">>): void;
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
  // Start as true so useRequireAuth does not redirect before the refresh
  // attempt settles.
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // On mount: attempt a silent refresh using the HttpOnly cookie.
  // If the cookie is absent or invalid, the user stays logged out and
  // isAuthLoading is set to false so useRequireAuth can redirect them.
  useEffect(() => {
    apiClient<LoginResult>(apiPaths.refresh(), {
      method: "POST",
      credentials: "include",
    })
      .then((data) => {
        setToken(data.access_token);
        setCurrentUser(data.user);
      })
      .catch(() => {
        // No valid refresh token — stay logged out. Do not redirect here;
        // useRequireAuth handles that once isAuthLoading is false.
      })
      .finally(() => {
        setIsAuthLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount only.

  async function login(email: string, password: string): Promise<void> {
    // The refresh token in the response body is kept for backward compat but
    // the authoritative copy now travels as an HttpOnly cookie set by the backend.
    const data = await loginRequest(email, password);

    setToken(data.access_token);
    setCurrentUser(data.user);
  }

  async function logout(): Promise<void> {
    // Ask the backend to revoke the refresh token and clear the HttpOnly cookie.
    // We swallow errors here because the user is logging out regardless.
    try {
      await apiClient<void>(apiPaths.logout(), {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignore — clear local state regardless of server response.
    }

    setToken(null);
    setCurrentUser(null);
  }

  function updateProfile(
    updates: Partial<Pick<AuthUser, "name" | "timezone">>
  ): void {
    if (currentUser === null) return;
    setCurrentUser({ ...currentUser, ...updates });
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        isAuthLoading,
        login,
        logout,
        updateProfile,
      }}
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
