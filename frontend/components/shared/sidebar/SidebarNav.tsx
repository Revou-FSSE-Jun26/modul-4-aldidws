"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  ListChecks,
  UserRound,
  FileText,
  Inbox,
  ChartNoAxesColumnIncreasing,
} from "lucide-react";

import type { NavLinkDef } from "./constants";
import { NavLabel } from "./NavLabel";
import { isActive } from "./utils";

const NAV_LINKS: NavLinkDef[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: <House size={18} strokeWidth={1.5} aria-hidden="true" />,
  },
  {
    label: "My Tasks",
    href: "/my-tasks",
    icon: <ListChecks size={18} strokeWidth={1.5} aria-hidden="true" />,
  },
  {
    label: "Profile",
    href: "/profile",
    icon: <UserRound size={18} strokeWidth={1.5} aria-hidden="true" />,
  },
  {
    label: "Notes",
    href: "/notes",
    icon: <FileText size={18} strokeWidth={1.5} aria-hidden="true" />,
  },
  {
    label: "Inbox",
    href: "/inbox",
    icon: <Inbox size={18} strokeWidth={1.5} aria-hidden="true" />,
  },
  {
    label: "Reports",
    href: "/reports",
    icon: (
      <ChartNoAxesColumnIncreasing
        size={18}
        strokeWidth={1.5}
        aria-hidden="true"
      />
    ),
  },
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
    <ul role="list" className="flex w-full flex-col gap-0.5">
      {NAV_LINKS.map((link) => {
        const active = isActive(pathname, link.href);

        return (
          <li key={link.label} className="w-full">
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? link.label : undefined}
              title={collapsed ? link.label : undefined}
              className={[
                "group relative flex h-9 w-full items-center rounded-lg",
                "transition-colors duration-150",
                "focus:outline-none focus-visible:ring-2",
                "focus-visible:ring-[#DCEBC0]",
                "focus-visible:ring-offset-2 focus-visible:ring-offset-[#173F35]",
                collapsed
                  ? "justify-center px-0"
                  : "justify-start px-2.5",
                active
                  ? "border border-[var(--border)] bg-white font-medium text-[#173F35] shadow-[var(--shadow-card)]"
                  : "text-white hover:bg-[#285346] hover:text-white",
              ].join(" ")}
            >
              {active && !collapsed && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#173F35]"
                />
              )}

              <span
                className={[
                  "flex shrink-0 items-center justify-center",
                  active ? "text-[#173F35]" : "text-white",
                  collapsed ? "h-full w-full" : "h-full w-[18px]",
                ].join(" ")}
              >
                {link.icon}
              </span>

              {!collapsed && (
                <span
                  className={[
                    "ml-2.5 min-w-0 flex-1",
                    active ? "text-[#173F35]" : "text-white group-hover:text-white",
                  ].join(" ")}
                >
                  <NavLabel collapsed={false}>
                    {link.label}
                  </NavLabel>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}