"use client";

import { useEffect, useState } from "react";
import { Users, CheckSquare, FolderOpen, ChevronDown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getWorkspaceSummary } from "@/lib/services/usersService";
import type { WorkspaceSummary } from "@/lib/types/api";

/**
 * WorkspaceSwitcher — displays the current user's workspace name and stats.
 *
 * Shows workspace_name, project count, task count, and member count from
 * GET /api/users/me/summary. No actual workspace switching is offered
 * (single-user workspaces only).
 */
export function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const { currentUser, token } = useAuth();
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getWorkspaceSummary(token)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const displayName =
    summary?.workspace_name ??
    (currentUser?.name ? `${currentUser.name}'s workspace` : currentUser?.email ?? "My workspace");

  if (compact) {
    return (
      <div
        data-workspace-switcher
        className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[var(--border)]"
        title={displayName}
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[var(--brand)] text-[11px] font-bold text-white"
        >
          R
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-workspace-switcher
        className="rounded-[12px] border border-[var(--border)] p-2"
      >
        <span
          data-workspace-name
          className="block truncate text-sm font-semibold text-[var(--text-primary)]"
        >
          {displayName}
        </span>
      </div>
    );
  }

  if (!summary) {
    return (
      <div
        data-workspace-switcher
        aria-busy="true"
        className="rounded-[12px] border border-[var(--border)] p-2"
      >
        <span
          data-workspace-name
          aria-label="Loading workspace"
          className="block h-4 w-24 animate-pulse rounded bg-[var(--bg-hover)]"
        >
          &nbsp;
        </span>
      </div>
    );
  }

  return (
    <div
      data-workspace-switcher
      className="rounded-[12px] border border-[var(--border)] p-2"
    >
      {/* Top row: logo tile + name + chevron */}
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-[var(--brand)] text-[11px] font-bold text-white"
          aria-hidden="true"
        >
          R
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-[var(--text-muted)]">Workspace</p>
          <p
            data-workspace-name
            className="truncate text-[13px] font-semibold text-[var(--text-primary)]"
          >
            {summary.workspace_name}
          </p>
        </div>
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          className="shrink-0 text-[var(--text-muted)]"
          aria-hidden="true"
        />
      </div>

      {/* Stats row */}
      <dl
        data-workspace-stats
        className="mt-2 flex items-center gap-3 border-t border-[var(--border)] pt-2"
      >
        <div className="flex items-center gap-1">
          <Users
            size={12}
            strokeWidth={1.5}
            className="text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <dt className="sr-only">Members</dt>
          <dd className="text-[12px] text-[var(--text-muted)]">{summary.members}</dd>
        </div>
        <div className="flex items-center gap-1">
          <CheckSquare
            size={12}
            strokeWidth={1.5}
            className="text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <dt className="sr-only">Tasks</dt>
          <dd className="text-[12px] text-[var(--text-muted)]">{summary.tasks}</dd>
        </div>
        <div className="flex items-center gap-1">
          <FolderOpen
            size={12}
            strokeWidth={1.5}
            className="text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <dt className="sr-only">Projects</dt>
          <dd className="text-[12px] text-[var(--text-muted)]">{summary.projects}</dd>
        </div>
      </dl>
    </div>
  );
}
