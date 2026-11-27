import { ChevronDown } from "lucide-react";
import type { User } from "@/lib/types/api";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { getUserInitials } from "./utils";

interface UserMenuProps {
  user: User;
  collapsed: boolean;
  onProfileClick: () => void;
  onSignOut: () => void;
}

/**
 * User menu with avatar, name, and action menu.
 */
export function UserMenu({ user, collapsed, onProfileClick, onSignOut }: UserMenuProps) {
  const displayName = user.name?.trim() || user.email || "";

  const userMenuItems = [
    { id: "profile", label: "Profile", onSelect: onProfileClick },
    { id: "sign-out", label: "Sign out", onSelect: onSignOut },
  ];

  return (
    <div className="border-t border-[var(--border)] pt-1">
      <ActionMenu
        label={`User menu for ${displayName}`}
        items={userMenuItems}
        triggerClassName={[
          "w-full h-auto border-0 bg-transparent rounded-lg",
          "hover:bg-[var(--bg-hover)]",
          collapsed ? "px-0 justify-center" : "px-2 py-1.5 justify-start gap-2",
        ].join(" ")}
        symbolNode={
          <>
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-semibold text-white"
            >
              {getUserInitials(displayName)}
            </span>
            {!collapsed && (
              <span className="flex min-w-0 flex-1 flex-col items-start overflow-hidden">
                <span className="block w-full truncate text-[13px] font-semibold text-[var(--text-primary)]">
                  {user.name || user.email}
                </span>
                <span className="block w-full truncate text-xs text-[var(--text-muted)]">{user.email}</span>
              </span>
            )}
            {!collapsed && (
              <ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" className="ml-auto shrink-0 text-[var(--text-muted)]" />
            )}
          </>
        }
      />
    </div>
  );
}
