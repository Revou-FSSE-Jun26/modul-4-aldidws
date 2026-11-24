"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/errors";
import { computeCardOrder } from "@/lib/cardOrder";
import { deleteCard, moveCard, updateCard } from "@/lib/services/cardsService";
import {
  createComment,
  deleteComment,
  listComments,
  updateComment,
} from "@/lib/services/commentsService";
import type { ApiComment, Card } from "@/lib/types/api";
import { BaseModal } from "@/components/shared/BaseModal";
import { BaseButton } from "@/components/shared/BaseButton";
import { CommentList, type Comment } from "@/components/board/CommentList";

const MAX_TITLE_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_COMMENT_LENGTH = 2000;

export interface CardModalColumn {
  id: string;
  name: string;
  /** Cards of this column (any order); used to compute the Float order on move. */
  cards: { id: string; order: number }[];
}

export interface CardDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: Card;
  /** All columns of the board, for the "Move to column" select. */
  columns: CardModalColumn[];
  onCardUpdated: (card: Card) => void;
  onCardDeleted: (cardId: string) => void;
  /** Called after the server accepted a move made from the select. */
  onCardMoved: () => void;
}

function toComment(c: ApiComment): Comment {
  return {
    id: c.id,
    authorId: c.author_id,
    authorName: c.author_name,
    body: c.body,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

// ---------------------------------------------------------------------------
// Comment form
// ---------------------------------------------------------------------------

function CommentForm({
  cardId,
  onCreated,
}: {
  cardId: string;
  onCreated: (comment: Comment) => void;
}) {
  const { token } = useAuth();
  const baseId = useId();
  const bodyId = `${baseId}-body`;
  const errorId = `${baseId}-error`;
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = body.trim();
  const isOverLimit = trimmed.length > MAX_COMMENT_LENGTH;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (trimmed.length === 0) {
      setError("Comment cannot be empty.");
      textareaRef.current?.focus();
      return;
    }
    if (isOverLimit) {
      setError(`Comment must be ${MAX_COMMENT_LENGTH} characters or fewer.`);
      return;
    }
    if (!token) {
      setError("You must be signed in to comment.");
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await createComment(token, cardId, trimmed);
      onCreated(toComment(created));
      setBody("");
      textareaRef.current?.focus();
    } catch (err: unknown) {
      setError(messageOf(err, "Failed to post comment."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2">
      <label htmlFor={bodyId} className="text-sm font-medium text-foreground">
        Add a comment
      </label>
      <textarea
        id={bodyId}
        ref={textareaRef}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          if (error) setError(null);
        }}
        rows={3}
        disabled={isSubmitting}
        aria-invalid={error !== null || isOverLimit}
        aria-describedby={error ? errorId : undefined}
        className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <p
          aria-live="polite"
          className={`text-xs ${isOverLimit ? "text-destructive" : "text-muted-foreground"}`}
        >
          {MAX_COMMENT_LENGTH - body.length} remaining
        </p>
        <BaseButton type="submit" disabled={isSubmitting || isOverLimit}>
          {isSubmitting ? "Posting…" : "Post comment"}
        </BaseButton>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Edit form (title + description)
// ---------------------------------------------------------------------------

function EditCardForm({
  card,
  onSaved,
}: {
  card: Card;
  onSaved: (card: Card) => void;
}) {
  const { token } = useAuth();
  const baseId = useId();
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("");
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Card title is required.");
      return;
    }
    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      setError(`Title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
      return;
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      setError(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);
      return;
    }
    if (!token) {
      setError("You must be signed in to edit cards.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateCard(token, card.id, {
        title: trimmedTitle,
        description,
      });
      onSaved(updated);
      setStatus("Card saved");
    } catch (err: unknown) {
      setError(messageOf(err, "Could not save the card."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2">
      <label htmlFor={`${baseId}-title`} className="text-sm font-medium text-foreground">
        Card title
      </label>
      <input
        id={`${baseId}-title`}
        type="text"
        value={title}
        disabled={isSaving}
        onChange={(e) => {
          setTitle(e.target.value);
          if (error) setError(null);
        }}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <label
        htmlFor={`${baseId}-description`}
        className="text-sm font-medium text-foreground"
      >
        Description
      </label>
      <textarea
        id={`${baseId}-description`}
        value={description}
        rows={4}
        disabled={isSaving}
        onChange={(e) => {
          setDescription(e.target.value);
          if (error) setError(null);
        }}
        className="resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
        {status}
      </p>
      <div>
        <BaseButton type="submit" disabled={isSaving}>
          {isSaving ? "Saving…" : "Save changes"}
        </BaseButton>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

/**
 * Card detail dialog: edit title and description, move to another column,
 * delete (with confirmation) and the comment thread (add, edit/delete own).
 */
export function CardDetailModal({
  isOpen,
  onClose,
  card,
  columns,
  onCardUpdated,
  onCardDeleted,
  onCardMoved,
}: CardDetailModalProps) {
  const { token, currentUser } = useAuth();
  const moveId = useId();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  // Load comments each time the modal opens for a card.
  useEffect(() => {
    if (!isOpen || !token) return;
    let cancelled = false;
    listComments(token, card.id)
      .then((items) => {
        if (cancelled) return;
        setCommentsError(null);
        setComments(items.map(toComment));
      })
      .catch((err: unknown) => {
        if (!cancelled) setCommentsError(messageOf(err, "Failed to load comments."));
      });
    return () => {
      cancelled = true;
      setComments(null);
    };
  }, [isOpen, token, card.id]);

  async function handleMove(targetColumnId: string) {
    if (!token || targetColumnId === card.column_id) return;
    const target = columns.find((c) => c.id === targetColumnId);
    const order = computeCardOrder(
      [...(target?.cards ?? [])].sort((a, b) => a.order - b.order),
      Number.MAX_SAFE_INTEGER,
      card.id,
    );
    setIsMoving(true);
    setActionError(null);
    try {
      await moveCard(token, card.id, { column_id: targetColumnId, order });
      onCardMoved();
    } catch (err: unknown) {
      setActionError(messageOf(err, "Could not move the card."));
    } finally {
      setIsMoving(false);
    }
  }

  async function handleDelete() {
    if (!token) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await deleteCard(token, card.id);
      setConfirmingDelete(false);
      onCardDeleted(card.id);
    } catch (err: unknown) {
      setConfirmingDelete(false);
      setActionError(
        err instanceof ApiError && err.isNotFound
          ? "This card no longer exists."
          : messageOf(err, "Could not delete the card."),
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleEditComment(commentId: string, body: string) {
    if (!token) throw new Error("You must be signed in.");
    const updated = toComment(await updateComment(token, commentId, body));
    setComments((prev) => (prev ?? []).map((c) => (c.id === commentId ? updated : c)));
  }

  async function handleDeleteComment(commentId: string) {
    if (!token) throw new Error("You must be signed in.");
    await deleteComment(token, commentId);
    setComments((prev) => (prev ?? []).filter((c) => c.id !== commentId));
  }

  return (
    <>
      {/* The card dialog is hidden while the confirm dialog is up so that
          Escape and focus handling only apply to one dialog at a time. */}
      <BaseModal
        isOpen={isOpen && !confirmingDelete}
        onClose={onClose}
        title={card.title}
        maxWidth="max-w-xl"
      >
        <div className="flex flex-col gap-4">
          <EditCardForm key={card.id} card={card} onSaved={onCardUpdated} />

          <div className="flex flex-col gap-1">
            <label htmlFor={moveId} className="text-sm font-medium text-foreground">
              Move to column
            </label>
            <select
              id={moveId}
              value={card.column_id}
              disabled={isMoving}
              onChange={(e) => void handleMove(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {columns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>

          {actionError && (
            <p role="alert" className="text-xs text-destructive">
              {actionError}
            </p>
          )}

          <div>
            <BaseButton variant="destructive" onClick={() => setConfirmingDelete(true)}>
              Delete card
            </BaseButton>
          </div>

          <hr className="border-border" />

          {commentsError ? (
            <p role="alert" className="text-xs text-destructive">
              {commentsError}
            </p>
          ) : comments === null ? (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Loading comments…
            </p>
          ) : (
            <CommentList
              comments={comments}
              currentUserId={currentUser?.id}
              onEdit={handleEditComment}
              onDelete={handleDeleteComment}
              footer={
                <CommentForm
                  cardId={card.id}
                  onCreated={(c) => setComments((prev) => [...(prev ?? []), c])}
                />
              }
            />
          )}
        </div>
      </BaseModal>

      <BaseModal
        isOpen={isOpen && confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete this card?"
        description="The card and access to its comments will be removed from the board."
        maxWidth="max-w-sm"
      >
        <div className="flex justify-end gap-2">
          <BaseButton variant="secondary" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </BaseButton>
          <BaseButton
            variant="destructive"
            disabled={isDeleting}
            onClick={() => void handleDelete()}
          >
            Confirm delete
          </BaseButton>
        </div>
      </BaseModal>
    </>
  );
}
