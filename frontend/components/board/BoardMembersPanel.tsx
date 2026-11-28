"use client";

import { useState, type FormEvent } from "react";
import { Check, Copy, Users } from "lucide-react";
import { inviteMember, removeMember } from "@/lib/services/membersService";
import { showError, showSuccess } from "@/lib/toast";
import type { BoardMember } from "@/lib/types/api";

interface BoardMembersPanelProps {
  boardId: string;
  token: string;
  members: BoardMember[];
  /** Only the board owner can manage members; others see the read-only list. */
  canManage: boolean;
  onChanged: () => void;
  /** Optional board URL to copy directly inside the share/members panel. */
  shareUrl?: string;
}

/**
 * A panel that lists every member of a board. The board owner
 * can invite by email (which must be a registered account) and remove
 * members (never the owner row).
 */
export function BoardMembersPanel({
  boardId,
  token,
  members,
  canManage,
  onChanged,
  shareUrl,
}: BoardMembersPanelProps) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const resolvedShareUrl =
    shareUrl ??
    (typeof window !== "undefined"
      ? `${window.location.origin}/boards/${boardId}`
      : `/boards/${boardId}`);

  async function handleCopyLink() {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(resolvedShareUrl);
      setCopied(true);
      showSuccess("Board link copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showError("Could not copy board link.");
    }
  }

  async function handleInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await inviteMember(token, boardId, trimmed);
      setEmail("");
      showSuccess("Invitation sent.");
      onChanged();
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Could not invite that user.";
      showError(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(userId: string) {
    setBusy(true);
    try {
      await removeMember(token, boardId, userId);
      showSuccess("Member removed.");
      onChanged();
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Could not remove that member.";
      showError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users size={16} strokeWidth={1.5} aria-hidden="true" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Members ({members.length})
          </h3>
        </div>

        <button
          type="button"
          onClick={() => void handleCopyLink()}
          className="inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-input)] px-2.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          {copied ? (
            <>
              <Check size={13} aria-hidden="true" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy size={13} aria-hidden="true" />
              <span>Copy link</span>
            </>
          )}
        </button>
      </div>

      <ul className="flex flex-wrap gap-2">
        {members.map((m) => (
          <li
            key={m.user_id}
            className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-input)] px-3 py-1 text-[13px]"
          >
            <span className="text-[var(--text-primary)]">
              {m.name ?? m.email}
            </span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                m.role === "owner"
                  ? "bg-[var(--brand-light)] text-[var(--brand-dark)]"
                  : "bg-[var(--bg-hover)] text-[var(--text-muted)]"
              }`}
            >
              {m.role}
            </span>
            {canManage && m.role !== "owner" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRemove(m.user_id)}
                aria-label={`Remove ${m.name ?? m.email}`}
                className="text-[var(--text-muted)] transition-colors hover:text-[var(--accent-red)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <form onSubmit={handleInvite} className="mt-3 flex gap-2" noValidate>
          <input
            type="email"
            value={email}
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Invite by email"
            className="h-8 min-w-0 flex-1 rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-input)] px-3 text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-light)] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="h-8 rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-panel)] px-3 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Invite
          </button>
        </form>
      )}
    </div>
  );
}