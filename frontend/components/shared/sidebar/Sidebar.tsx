"use client";

import { useRouter } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { WorkspaceSwitcher } from "@/components/shared/WorkspaceSwitcher";
import { SidebarNav } from "./SidebarNav";
import { BoardsSection } from "./BoardsSection";
import { UserMenu } from "./UserMenu";
import { useSidebarCollapse } from "./useSidebarCollapse";
import { useSidebarSections } from "./useSidebarSections";
import { useBoardsData } from "./useBoardsData";

/**
 * Main application sidebar with navigation, boards, and user menu.
 * Supports collapsed and expanded states with localStorage persistence.
 */
export function Sidebar() {
  const { currentUser, logout, token } = useAuth();
  const router = useRouter();

  // State management hooks
  const { collapsed, toggleCollapsed } = useSidebarCollapse();
  const { openSections, toggleSection } = useSidebarSections();
  const { boards, favorites, handleToggleFavorite } = useBoardsData(token);

  // Event handlers
  async function handleSignOut() {
    router.replace("/login");
    await logout();
  }

  function handleProfileClick() {
    router.push("/profile");
  }

  // Computed classes
  const sidebarWidth = collapsed ? "w-14" : "w-[215px]";
  const sidebarPadding = collapsed ? "p-2" : "p-3";

  return (
    <aside
      data-collapsed={collapsed ? "true" : "false"}
      suppressHydrationWarning
      className={[
        "relative flex h-full shrink-0 flex-col overflow-hidden",
        "border-r border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-primary)]",
        "transition-[width,padding] duration-200 ease-in-out",
        sidebarWidth,
        sidebarPadding,
      ].join(" ")}
    >
      {/* Top: workspace switcher + collapse toggle */}
      <div
        className={[
          "flex shrink-0 items-center gap-1.5 pb-2",
          collapsed ? "justify-center flex-col" : "justify-between",
        ].join(" ")}
      >
        {collapsed ? (
          <WorkspaceSwitcher compact />
        ) : (
          <div className="min-w-0 flex-1">
            <WorkspaceSwitcher />
          </div>
        )}

        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          onClick={toggleCollapsed}
          className={[
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-ctrl)]",
            "text-[var(--text-muted)] transition-colors duration-150",
            "hover:bg-[var(--bg-hover)] focus:outline-none",
            "focus-visible:ring-2 focus-visible:ring-[var(--brand-light)] focus-visible:ring-offset-2",
          ].join(" ")}
        >
          {collapsed ? (
            <PanelLeftOpen size={15} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={15} strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav aria-label="Sidebar navigation" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        <SidebarNav collapsed={collapsed} />

        {/* Favorites section */}
        <BoardsSection
          label="Favorites"
          boards={favorites}
          open={openSections.favorites}
          collapsed={collapsed}
          onToggle={() => toggleSection("favorites")}
          onToggleFavorite={handleToggleFavorite}
          emptyMessage="No favorites yet"
        />

        {/* Projects section */}
        <BoardsSection
          label="Projects"
          boards={boards}
          open={openSections.projects}
          collapsed={collapsed}
          onToggle={() => toggleSection("projects")}
          onToggleFavorite={handleToggleFavorite}
          emptyMessage="No boards yet"
        />
      </nav>

      {/* Bottom: user menu */}
      <div className={["mt-2 flex shrink-0 flex-col gap-1", collapsed ? "items-center" : ""].join(" ")}>
        {currentUser && (
          <UserMenu
            user={currentUser}
            collapsed={collapsed}
            onProfileClick={handleProfileClick}
            onSignOut={handleSignOut}
          />
        )}
      </div>
    </aside>
  );
}
