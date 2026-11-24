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

/** App header. Rendered only while a user is signed in. */
export function Header() {
  const { token, currentUser, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  if (!token) return null;

  const displayName = currentUser?.name?.trim() || currentUser?.email || "";

  async function handleLogout() {
    setMenuOpen(false);
    router.replace("/login");
    await logout();
  }

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6 lg:px-8">
        <span className="text-base font-semibold text-foreground">RevoTask</span>

        <div className="flex items-center gap-2 sm:order-last">
          <NotificationBell />
          <BaseButton
            variant="secondary"
            size="sm"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
            className="sm:hidden"
          >
            Menu
          </BaseButton>
        </div>

        <nav
          id={menuId}
          aria-label="Main"
          className={[
            menuOpen ? "flex" : "hidden",
            "w-full flex-col gap-1 sm:order-none sm:flex sm:w-auto sm:flex-row sm:items-center sm:gap-4",
          ].join(" ")}
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(pathname, link.href) ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
              className={[
                "flex min-h-11 items-center rounded px-2 text-sm sm:min-h-0",
                isActive(pathname, link.href)
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {link.label}
            </Link>
          ))}
          <span className="px-2 text-sm text-muted-foreground">{displayName}</span>
          <BaseButton variant="secondary" size="sm" onClick={handleLogout}>
            Log out
          </BaseButton>
        </nav>
      </div>
    </header>
  );
}
