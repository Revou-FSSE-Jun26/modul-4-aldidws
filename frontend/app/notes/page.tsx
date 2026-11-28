"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  Pin,
  FolderKanban,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { showSuccess, showError } from "@/lib/toast";
import { readNotes, writeNotes, type Note } from "@/lib/notesStorage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

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
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTitle(note?.title ?? "");
    setBody(note?.body ?? "");
    setShowDelete(false);
  }, [note]);

  useEffect(() => {
    titleInputRef.current?.focus();
  }, [note]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave(title.trim(), body);
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-2xl border border-[#E6E8E3] bg-white p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h2 className="text-base font-semibold text-[#162B22]">
            {isEdit ? "Edit note" : "New note"}
          </h2>
          <span className="text-xs text-[#7C8680]">
            {isEdit
              ? "Refine your note title or content."
              : "Give a thought a place to grow."}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {isEdit && (
            <button
              type="button"
              onClick={() => setShowDelete((v) => !v)}
              aria-expanded={showDelete}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#6E7A73] transition-colors hover:bg-[#F3F4F0] hover:text-[#B33B24]"
            >
              <Trash2 size={13} strokeWidth={1.75} aria-hidden="true" />
              {showDelete ? "Cancel delete" : "Delete"}
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close note editor"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#7C8680] transition-colors hover:bg-[#F3F4F0] hover:text-[#162B22]"
          >
            <X size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>

      {showDelete && isEdit && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E6E8E3] bg-[#FAFBF8] px-3.5 py-2.5 text-xs text-[#3F5347]"
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

      <div className="flex flex-col gap-3">
        <input
          ref={titleInputRef}
          type="text"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          aria-label="Note title"
          className="h-10 w-full rounded-lg border border-[#16382C] bg-white px-3.5 text-sm text-[#162B22] placeholder:text-[#92968D] focus:outline-none"
        />

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Write your note..."
          aria-label="Note body"
          className="min-h-[108px] w-full resize-y rounded-lg border border-[#DCDFD8] bg-white px-3.5 py-2.5 text-sm text-[#162B22] placeholder:text-[#92968D] focus:border-[#16382C] focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <BaseButton
          type="submit"
          size="sm"
          disabled={!title.trim()}
          className="cursor-pointer"
        >
          {isEdit ? "Save changes" : "Create note"}
        </BaseButton>
        <BaseButton
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
          className="cursor-pointer"
        >
          Cancel
        </BaseButton>
        <span className="text-xs text-[#8C9590]">
          Start with a title and a few words.
        </span>
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
        "flex flex-col gap-2.5 rounded-2xl border bg-white p-5 transition-colors",
        note.pinned
          ? "border-[#B9CCA4] border-l-4 border-l-[#4E7A58]"
          : "border-[#E6E8E3] border-l-4 border-l-[#DCE5CC] hover:border-[#CFD6C6]",
      ].join(" ")}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-[#162B22]">
              {note.title}
            </h3>
            {note.pinned && (
              <BaseBadge className="border-transparent bg-[#DCE5CC] text-[#1D4E38]">
                Pinned
              </BaseBadge>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[#7C8680]">
            <Clock size={11} strokeWidth={1.75} aria-hidden="true" />
            <span>Updated {relativeTime(note.updatedAt, now)}</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onTogglePin(note.id)}
            aria-label={note.pinned ? "Unpin note" : "Pin note"}
            aria-pressed={note.pinned}
            className={[
              "flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors",
              note.pinned
                ? "bg-[#DCE5CC]/70 text-[#16382C]"
                : "text-[#8C9590] hover:bg-[#F3F4F0] hover:text-[#162B22]",
            ].join(" ")}
          >
            <Pin size={13} strokeWidth={1.75} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => onEdit(note)}
            aria-label="Edit note"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#8C9590] transition-colors hover:bg-[#F3F4F0] hover:text-[#162B22]"
          >
            <Pencil size={13} strokeWidth={1.75} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setShowDelete((v) => !v)}
            aria-label={showDelete ? "Cancel delete" : "Delete note"}
            aria-expanded={showDelete}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#8C9590] transition-colors hover:bg-[#F3F4F0] hover:text-[#B33B24]"
          >
            <Trash2 size={13} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div
        className={[
          "mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-[#4E6356]",
          !expanded && "line-clamp-3",
        ].join(" ")}
      >
        {note.body.trim() === "" ? (
          <span className="italic text-[#8C9590]">No content</span>
        ) : (
          note.body
        )}
      </div>

      {note.body.length > 240 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#16382C] transition-colors hover:bg-[#EBF0E2]"
        >
          {expanded ? (
            <>
              <ChevronUp size={13} aria-hidden="true" /> Show less
            </>
          ) : (
            <>
              <ChevronDown size={13} aria-hidden="true" /> Show more
            </>
          )}
        </button>
      )}

      {showDelete && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E6E8E3] bg-[#FAFBF8] px-3 py-2 text-xs text-[#3F5347]"
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

function NotesContent({
  userId,
  workspaceLabel,
}: {
  userId: string;
  workspaceLabel: string;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  const editorRef = useRef<HTMLFormElement | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const noteParam = searchParams.get("note");
  const handledNoteRef = useRef<string | null>(null);

  useEffect(() => {
    if (!noteParam) {
      handledNoteRef.current = null;
      return;
    }
    if (!hydrated || handledNoteRef.current === noteParam) return;
    handledNoteRef.current = noteParam;

    const target = notes.find((n) => n.id === noteParam);
    if (target) {
      setCreating(false);
      setSearch("");
      setShowPinnedOnly(false);
      setEditing(target);
    } else {
      showError("That note could not be found.");
    }
    router.replace(pathname, { scroll: false });
  }, [noteParam, hydrated, notes, router, pathname]);

  useEffect(() => {
    setNotes(readNotes(userId));
    setHydrated(true);
  }, [userId]);

  useEffect(() => {
    if (creating || editing) {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [creating, editing]);

  function commit(next: Note[]) {
    try {
      writeNotes(userId, next);
      setNotes(next);
    } catch {
      // Error toast is already handled inside writeNotes
    }
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
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [notes, search, showPinnedOnly]);

  const isEditorOpen = creating || editing !== null;

  return (
    <div className="flex w-full flex-1 flex-col gap-5">
      {/* 1. Hero Banner (Sage Green Card) */}
      <section
        aria-label="Notes summary"
        className="flex flex-col justify-between gap-4 rounded-2xl bg-[#DCE5CC] px-7 py-6 sm:flex-row sm:items-center"
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4E6356]">
            YOUR SPACE
          </p>
          <h1 className="mt-1 truncate font-serif text-3xl italic tracking-tight text-[#162B22] sm:text-[34px] sm:leading-tight">
            Your notes
          </h1>
          <p className="mt-1.5 text-[13px] text-[#3F5347]">
            Big ideas, small thoughts. A space to keep them all.
          </p>
        </div>

        <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-white/95 px-3.5 py-2 text-xs font-medium text-[#162B22] shadow-2xs">
          <FolderKanban size={14} strokeWidth={1.75} aria-hidden="true" />
          <span>{workspaceLabel}</span>
        </div>
      </section>

      {/* 2. Toolbar Row: Search + Pinned only + New note */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2.5 rounded-xl border border-[#E6E8E3] bg-white px-3.5 transition-colors focus-within:border-[#16382C]">
          <Search
            size={14}
            strokeWidth={1.75}
            className="shrink-0 text-[#7C8680]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            aria-label="Search notes"
            className="w-full min-w-0 bg-transparent text-xs text-[#162B22] outline-none placeholder:text-[#92968D]"
          />
        </label>

        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-[#E6E8E3] bg-white px-3.5 text-xs font-medium text-[#3F5347] transition-colors hover:bg-[#FAFBF8]">
          <input
            type="checkbox"
            checked={showPinnedOnly}
            onChange={(e) => setShowPinnedOnly(e.target.checked)}
            className="h-3.5 w-3.5 cursor-pointer rounded border-[#CFD3CA] accent-[#16382C]"
          />
          <span>Pinned only</span>
        </label>

        <button
          type="button"
          disabled={isEditorOpen}
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
          className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-[#E6E8E3] bg-white px-4 text-xs font-medium text-[#162B22] transition-colors hover:bg-[#FAFBF8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={14} strokeWidth={1.75} aria-hidden="true" />
          <span>New note</span>
        </button>
      </div>

      {/* 3. Inline Editor */}
      {isEditorOpen && (
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

      {/* 4. All Notes Section */}
      <section aria-label="All notes" className="flex flex-col gap-3.5 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[#162B22]">All notes</h2>
            <span className="rounded-md bg-[#EAECE6] px-1.5 py-0.5 text-[11px] font-semibold text-[#4E6356]">
              {filtered.length}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[#7C8680]">
            A little order for your everyday ideas.
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#CFD3CA] bg-white px-6 py-12 text-center">
            <StickyNote
              size={32}
              strokeWidth={1.4}
              aria-hidden="true"
              className="text-[#6E7A73]"
            />
            <p className="text-sm font-medium text-[#162B22]">
              {notes.length === 0
                ? "No notes yet"
                : search
                  ? "No notes match your search"
                  : "No pinned notes yet"}
            </p>
            <p className="max-w-sm text-xs text-[#6E7A73]">
              {notes.length === 0
                ? "Create your first note to keep quick ideas and reminders handy."
                : search
                  ? "Try a different keyword or clear the search box."
                  : "Pin important notes so they stay right at the top."}
            </p>
            {notes.length === 0 && !isEditorOpen && (
              <BaseButton
                type="button"
                size="sm"
                onClick={() => setCreating(true)}
                className="mt-1 cursor-pointer"
              >
                <Plus size={14} aria-hidden="true" /> Create a note
              </BaseButton>
            )}
          </div>
        ) : (
          <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-label={`${filtered.length} notes`}
          >
            {filtered.map((n) => (
              <NoteCard
                key={n.id}
                note={n}
                onEdit={(target) => {
                  setCreating(false);
                  setEditing(target);
                }}
                onDelete={handleDelete}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Notes — personal scratchpad. Notes are stored in localStorage keyed per
 * user id (so each account sees only its own notes). Create, edit, pin,
 * delete, search.
 */
export default function NotesPage() {
  const { token, isAuthLoading, user } = useRequireAuth();
  const { currentUser } = useAuth();

  const activeUser = currentUser ?? user;
  const userId = activeUser?.id ?? "";
  const workspaceLabel =
    activeUser?.name?.trim() ||
    activeUser?.email?.split("@")[0] ||
    "Personal";

  return (
    <div className="flex min-h-full w-full flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8">
      {isAuthLoading || !token || !userId ? (
        <div
          className="flex flex-col gap-5"
          aria-busy="true"
          aria-label="Loading notes"
        >
          <div className="h-32 animate-pulse rounded-2xl bg-[#DCE5CC]/70" />
          <div className="h-10 animate-pulse rounded-xl border border-[#E6E8E3] bg-white" />
          <div className="h-44 animate-pulse rounded-2xl border border-[#E6E8E3] bg-white" />
        </div>
      ) : (
        <Suspense fallback={null}>
          <NotesContent
            userId={userId}
            workspaceLabel={`${workspaceLabel}'s workspace`}
          />
        </Suspense>
      )}
    </div>
  );
}