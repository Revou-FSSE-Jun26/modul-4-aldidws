"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/**
 * Client-side route guard (UX only; the backend still enforces authorization).
 *
 * Redirects to /login once AuthContext has finished loading and no token is
 * present. Never redirects while auth is still loading.
 */
export function useRequireAuth(): {
  token: string | null;
  isAuthLoading: boolean;
} {
  const { token, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthLoading && !token) {
      router.replace("/login");
    }
  }, [isAuthLoading, token, router]);

  return { token, isAuthLoading };
}
