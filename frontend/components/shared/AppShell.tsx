"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/shared/Sidebar";

/** Paths where sidebar, rail, and header should be hidden. */
const AUTH_PATHS = ["/login", "/register"];

/**
 * AppShell — renders the icon rail and Sidebar only on non-auth pages.
 * Wraps children in the data-layout flex container.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = AUTH_PATHS.includes(pathname);

  if (isAuth) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--bg-page)]">
        {children}
      </div>
    );
  }

  return (
    <div data-layout className="flex h-full">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
