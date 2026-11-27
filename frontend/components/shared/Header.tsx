"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { BaseButton } from "@/components/shared/BaseButton";
import { NotificationBell } from "@/components/shared/NotificationBell";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/my-tasks", label: "My Tasks" },
  { href: "/profile", label: "Profile" },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * App header. Rendered only while a user is signed in.
 *
 * Phase 2: hidden on board pages (/boards/*) — BoardDetailView renders its
 * own board-level header row (spec §4.2) there. On other pages it renders a
 * slim white strip with the notification bell, nav links and the user menu.
 */
export function Header() {
  const { token, currentUser, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  if (!token) return null;
  // Board pages render their own header row (§4.2) — avoid double chrome.
  if (pathname?.startsWith("/boards/")) return null;

  const displayName = currentUser?.name?.trim() || currentUser?.email || "";

  async function handleLogout() {
    setMenuOpen(false);
    router.replace("/login");
    await logout();
  }

  return (
    <header className="border-b border-[var(--border)] bg-[var(--bg-panel)]">
      <div className="flex items-center justify-between gap-2 px-4 py-1.5">
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">
          RevoTask
        </span>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <BaseButton
            variant="secondary"
            size="sm"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
            className="md:hidden"
          >
            Menu
          </BaseButton>
        </div>

        <nav
          id={menuId}
          aria-label="Main"
          className={[
            menuOpen ? "flex" : "hidden",
            "w-full flex-col gap-1 md:order-none md:flex md:w-auto md:flex-row md:items-center md:gap-3",
          ].join(" ")}
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(pathname, link.href) ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
              className={[
                "flex min-h-9 items-center rounded-[var(--radius-ctrl)] px-2.5 text-[13px] font-medium transition-colors duration-150 md:min-h-0",
                isActive(pathname, link.href)
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
              ].join(" ")}
            >
              {link.label}
            </Link>
          ))}
          <span className="hidden px-2 text-[13px] text-[var(--text-muted)] md:inline">
            {displayName}
          </span>
          <BaseButton variant="secondary" size="sm" onClick={handleLogout}>
            Log out
          </BaseButton>
        </nav>
      </div>
    </header>
  );
}
