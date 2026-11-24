"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { login as loginRequest } from "@/lib/services/authService";
import type { User } from "@/lib/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuthUser = User;

interface AuthContextValue {
  currentUser: AuthUser | null;
  /** In-memory access token. NEVER stored in localStorage or sessionStorage. */
  token: string | null;
  /** Always false: nothing async runs on mount (the backend has no refresh endpoint). */
  isLoading: boolean;
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
  const isLoading = false;

  async function login(email: string, password: string): Promise<void> {
    // The refresh token in the response is intentionally discarded.
    const data = await loginRequest(email, password);

    setToken(data.access_token);
    setCurrentUser(data.user);
  }

  async function logout(): Promise<void> {
    // The backend has no logout endpoint, so this only clears client state.
    // The access token stays valid until it expires.
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
