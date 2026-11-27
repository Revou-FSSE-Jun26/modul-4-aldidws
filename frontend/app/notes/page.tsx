"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  StickyNote,
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { showSuccess, showError } from "@/lib/toast";
import { BoardBgWrapper } from "@/components/board/BoardBgWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import type { FormEvent } from "react";

// ---------------------------------------------------------------------------
// Types & storage
// ---------------------------------------------------------------------------

interface Note {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

const STORAGE_PREFIX = "kanban-notes:v1:";

function storageKey(userId: string): string {
  return STORAGE_PREFIX + userId;
}

function readNotes(userId: string): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Minimal shape validation.
    return parsed.filter(
      (n): n is Note =>
        n !== null &&
        typeof n === "object" &&
        "id" in n &&
        "title" in n &&
        "body" in n &&
        "pinned" in n,
    ) as Note[];
  } catch {
    return [];
  }
}

function writeNotes(userId: string, notes: Note[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(notes));
  } catch (err) {
    // Most likely QuotaExceededError.
    showError("Could not save notes to this browser. Storage may be full.");
    throw err;
  }
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers.
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string, now: Date): string {
  const t = new Date(iso).getTime();
  const diff = now.getTime() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NoteEditor({
  note,
  onSave,
  onCancel,
  onDelete,
  formRef,
}: {
  note: Note | null;
  onSave: (title: string, body: string) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
  formRef: React.RefObject<HTMLFormElement | null>;
}) {
  const isEdit = note !== null;
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [showDelete, setShowDelete] = useState(false);

  // Reset form fields when the opened note changes.
  useEffect(() => {
    setTitle(note?.title ?? "");
    setBody(note?.body ?? "");
    setShowDelete(false);
  }, [note]);

  // Focus the form when it opens (called from the parent's effect).
  useEffect(() => {
    formRef.current?.focus();
  }, [formRef]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave(title.trim(), body);
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-panel)] p-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          {isEdit ? "Edit note" : "New note"}
        </h2>
        {isEdit && (
          <button
            type="button"
            onClick={() => setShowDelete((v) => !v)}
            aria-expanded={showDelete}
            className="inline-flex items-center gap-1 rounded-[var(--radius-ctrl)] px-2 py-1 text-xs font-medium text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--bg-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)]"
          >
            <Trash2 size={12} aria-hidden="true" />
            {showDelete ? "Cancel delete" : "Delete"}
          </button>
        )}
      </div>

      {showDelete && isEdit && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-hover)] p-2 text-xs text-[var(--text-secondary)]"
        >
          <span>Delete this note permanently?</span>
          <div className="flex gap-2">
            <BaseButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowDelete(false)}
            >
              Cancel
            </BaseButton>
            <BaseButton
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => note && onDelete(note.id)}
            >
              Delete
            </BaseButton>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          aria-label="Note title"
          autoFocus
          className="rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)]"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="Write your note…"
          aria-label="Note body"
          className="min-h-[120px] resize-y rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <BaseButton type="submit" disabled={!title.trim()}>
          {isEdit ? "Save changes" : "Create note"}
        </BaseButton>
        <BaseButton variant="secondary" type="button" onClick={onCancel}>
          Cancel
        </BaseButton>
      </div>
    </form>
  );
}

function NoteCard({
  note,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const now = new Date();

  function closeDelete() {
    setShowDelete(false);
  }

  return (
    <article
      className={[
        "group relative flex flex-col gap-3 rounded-[var(--radius-card)] border bg-[var(--bg-panel)] p-4 shadow-[var(--shadow-card)] transition-shadow duration-150",
        note.pinned ? "border-[var(--brand)] border-l-2" : "border-[var(--border)]",
      ].join(" ")}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">
              {note.title}
            </h3>
            {note.pinned && (
              <BaseBadge variant="primary">Pinned</BaseBadge>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <Clock size={12} aria-hidden="true" />
            Updated {relativeTime(note.updatedAt, now)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onTogglePin(note.id)}
            aria-label={note.pinned ? "Unpin note" : "Pin note"}
            aria-pressed={note.pinned}
            className="rounded-[var(--radius-ctrl)] p-1.5 text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--bg-hover)] hover:text-[var(--brand)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)]"
          >
            <ChevronDown
              size={14}
              strokeWidth={1.5}
              aria-hidden="true"
              className={note.pinned ? "rotate-180" : ""}
            />
          </button>
          <button
            type="button"
            onClick={() => onEdit(note)}
            aria-label="Edit note"
            className="rounded-[var(--radius-ctrl)] p-1.5 text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)]"
          >
            <Pencil size={14} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setShowDelete((v) => !v)}
            aria-label={showDelete ? "Cancel delete" : "Delete note"}
            aria-expanded={showDelete}
            className="rounded-[var(--radius-ctrl)] p-1.5 text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--bg-hover)] hover:text-[var(--accent-red)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)]"
          >
            <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div
        className={[
          "whitespace-pre-wrap break-words text-sm text-[var(--text-secondary)]",
          !expanded && "line-clamp-3",
        ].join(" ")}
      >
        {note.body.trim() === "" ? (
          <span className="italic text-[var(--text-muted)]">No content</span>
        ) : (
          note.body
        )}
      </div>

      {note.body.length > 240 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 self-start rounded-[var(--radius-ctrl)] px-2 py-1 text-xs font-medium text-[var(--brand)] transition-colors duration-150 hover:bg-[var(--brand-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)]"
        >
          {expanded ? (
            <>
              <ChevronUp size={12} aria-hidden="true" /> Show less
            </>
          ) : (
            <>
              <ChevronDown size={12} aria-hidden="true" /> Show more
            </>
          )}
        </button>
      )}

      {showDelete && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-hover)] p-2 text-xs text-[var(--text-secondary)]"
          onClick={closeDelete}
        >
          <span>Delete this note permanently?</span>
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <BaseButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={closeDelete}
            >
              Cancel
            </BaseButton>
            <BaseButton
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => onDelete(note.id)}
            >
              Delete
            </BaseButton>
          </div>
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

function NotesContent({ userId }: { userId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  const editorRef = useRef<HTMLFormElement | null>(null);

  // Load notes from localStorage once mounted for this user.
  useEffect(() => {
    setNotes(readNotes(userId));
    setHydrated(true);
  }, [userId]);

  // Focus the editor when it opens.
  useEffect(() => {
    if (creating || editing) {
      editorRef.current?.focus();
    }
  }, [creating, editing]);

  function commit(next: Note[]) {
    setNotes(next);
    writeNotes(userId, next);
  }

  function handleSave(title: string, body: string) {
    if (editing) {
      const updated: Note = {
        ...editing,
        title,
        body,
        updatedAt: new Date().toISOString(),
      };
      commit(notes.map((n) => (n.id === editing.id ? updated : n)));
      showSuccess("Note updated.");
      setEditing(null);
    } else {
      const nowIso = new Date().toISOString();
      const created: Note = {
        id: uid(),
        title,
        body,
        pinned: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      commit([created, ...notes]);
      showSuccess("Note created.");
      setCreating(false);
    }
  }

  function handleDelete(id: string) {
    commit(notes.filter((n) => n.id !== id));
    if (editing?.id === id) setEditing(null);
    showSuccess("Note deleted.");
  }

  function handleTogglePin(id: string) {
    commit(notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = notes;
    if (showPinnedOnly) list = list.filter((n) => n.pinned);
    if (q) {
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q),
      );
    }
    // Pinned first, then most recently updated.
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [notes, search, showPinnedOnly]);

  const pinnedCount = notes.filter((n) => n.pinned).length;

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search
            size={14}
            strokeWidth={1.5}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes…"
            aria-label="Search notes"
            className="w-full rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-input)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)]"
          />
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={showPinnedOnly}
          onClick={() => setShowPinnedOnly((v) => !v)}
          className={[
            "inline-flex items-center gap-2 rounded-[var(--radius-ctrl)] border px-3 py-1.5 text-xs font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)]",
            showPinnedOnly
              ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
              : "border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
          ].join(" ")}
        >
          <ChevronDown
            size={12}
            strokeWidth={1.5}
            aria-hidden="true"
            className={showPinnedOnly ? "rotate-180" : ""}
          />
          Pinned only
          {pinnedCount > 0 && (
            <span className="rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {pinnedCount}
            </span>
          )}
        </button>

        <div className="flex gap-2">
          <BaseButton
            variant="secondary"
            onClick={() => {
              setCreating(true);
              setEditing(null);
            }}
            disabled={creating || !!editing}
          >
            <Plus size={14} aria-hidden="true" /> New note
          </BaseButton>
        </div>
      </div>

      {/* Editor (only shown when creating or editing) */}
      {(creating || editing) && (
        <NoteEditor
          note={editing}
          onSave={handleSave}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
          onDelete={handleDelete}
          formRef={editorRef}
        />
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-[var(--border)] bg-[var(--bg-panel)]/60 px-6 py-14 text-center">
          <StickyNote
            size={36}
            strokeWidth={1.25}
            aria-hidden="true"
            className="text-[var(--text-muted)]"
          />
          <p className="text-sm text-[var(--text-secondary)]">
            {notes.length === 0
              ? "No notes yet. Create your first one to get started."
              : search
                ? "No notes match your search."
                : showPinnedOnly
                  ? "No pinned notes."
                  : "No notes."}
          </p>
          {notes.length === 0 && (
            <BaseButton onClick={() => setCreating(true)}>
              <Plus size={14} aria-hidden="true" /> Create a note
            </BaseButton>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={`${filtered.length} notes`}>
          {filtered.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              onEdit={setEditing}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Notes — personal scratchpad. Notes are stored in localStorage keyed per
 * user id (so each account sees only its own notes). Create, edit, pin,
 * delete, search. This is intentionally a local feature: no backend.
 */
export default function NotesPage() {
  const { token, isAuthLoading } = useRequireAuth();
  const { currentUser } = useAuth();

  const userId = currentUser?.id ?? "";

  return (
    <BoardBgWrapper className="flex flex-1 flex-col">
      <PageHeader
        title="Notes"
        description="Personal scratchpad, saved to this browser."
        icon={<StickyNote size={16} strokeWidth={1.5} />}
      />
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          {isAuthLoading || !token || !currentUser ? (
            <div
              className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-panel)] p-10"
              aria-busy="true"
              aria-label="Loading notes"
            >
              <Loader2
                size={20}
                strokeWidth={1.5}
                aria-hidden="true"
                className="animate-spin text-[var(--text-muted)]"
              />
              <p className="text-sm text-[var(--text-muted)]">Loading…</p>
            </div>
          ) : (
            <NotesContent userId={userId} />
          )}
        </div>
      </main>
    </BoardBgWrapper>
  );
}
