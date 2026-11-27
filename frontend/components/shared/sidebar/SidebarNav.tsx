import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  User,
  FileText,
  Inbox,
  BarChart2,
} from "lucide-react";
import type { NavLinkDef } from "./constants";
import { NavLabel } from "./NavLabel";
import { isActive } from "./utils";

const NAV_LINKS: NavLinkDef[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard size={18} strokeWidth={1.5} aria-hidden="true" /> },
  { label: "My Tasks", href: "/my-tasks", icon: <CheckSquare size={18} strokeWidth={1.5} aria-hidden="true" /> },
  { label: "Profile", href: "/profile", icon: <User size={18} strokeWidth={1.5} aria-hidden="true" /> },
  { label: "Notes", href: "/notes", icon: <FileText size={18} strokeWidth={1.5} aria-hidden="true" /> },
  { label: "Inbox", href: "/inbox", icon: <Inbox size={18} strokeWidth={1.5} aria-hidden="true" /> },
  { label: "Reports", href: "/reports", icon: <BarChart2 size={18} strokeWidth={1.5} aria-hidden="true" /> },
];

interface SidebarNavProps {
  collapsed: boolean;
}

/**
 * Primary navigation links section.
 */
export function SidebarNav({ collapsed }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <ul role="list" className="flex flex-col gap-0.5">
      {NAV_LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <li key={link.label}>
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? link.label : undefined}
              className={[
                "relative flex h-9 items-center rounded-lg transition-colors duration-150",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)] focus-visible:ring-offset-2",
                collapsed ? "justify-center px-0" : "px-2.5",
                active
                  ? "border border-[var(--border)] bg-[var(--bg-panel)] font-medium shadow-[var(--shadow-card)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
              ].join(" ")}
            >
              {active && !collapsed && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[var(--brand)]"
                />
              )}
              {link.icon}
              <NavLabel collapsed={collapsed}>{link.label}</NavLabel>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
