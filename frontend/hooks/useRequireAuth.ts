"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/**
 * Client-side route guard (UX only; the backend still enforces authorization).
 *
 * Redirects to /login?next=<current path> once AuthContext has finished
 * loading and no token is present, so login can return the user to the page
 * they asked for. Never redirects while auth is still loading.
 */
export function useRequireAuth(): {
  token: string | null;
  isAuthLoading: boolean;
} {
  const { token, isAuthLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthLoading && !token) {
      const target =
        pathname && pathname !== "/"
          ? `/login?next=${encodeURIComponent(pathname)}`
          : "/login";
      router.replace(target);
    }
  }, [isAuthLoading, token, router, pathname]);

  return { token, isAuthLoading };
}
