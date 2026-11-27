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
import {
  deleteCard,
  moveCard,
  setCardLabels,
  updateCard,
} from "@/lib/services/cardsService";
import { deleteLabel } from "@/lib/services/labelsService";
import {
  createComment,
  deleteComment,
  listComments,
  updateComment,
} from "@/lib/services/commentsService";
import { setCardAssignees } from "@/lib/services/membersService";
import type { ApiComment, BoardMember, Card, Label } from "@/lib/types/api";
import { BaseModal } from "@/components/shared/BaseModal";
import { BaseButton } from "@/components/shared/BaseButton";
import { CommentList, type Comment } from "@/components/board/CommentList";
import { DueDateField } from "@/components/board/DueDateField";
import { LabelManager } from "@/components/board/LabelManager";
import { LabelPicker } from "@/components/board/LabelPicker";

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
  boardId: string;
  /** All labels of the board. */
  boardLabels: Label[];
  /** Number of cards that carry each label (by label id), for the delete message. */
  labelUsage?: Record<string, number>;
  /** Called after a label was created, changed or deleted so the board reloads. */
  onLabelsChanged: () => void;
  /**
   * Board members, shown in the "Assignees" picker.  The picker is rendered
   * only when *isBoardOwner* is true and the list is non-empty.
   */
  boardMembers?: BoardMember[];
  /** True when the caller is the board owner. */
  isBoardOwner?: boolean;
  /** Called after an assignee set change so the board reloads. */
  onCardAssigneesChanged?: () => void;
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
  boardId,
  boardLabels,
  labelUsage = {},
  onLabelsChanged,
  boardMembers = [],
  isBoardOwner = false,
  onCardAssigneesChanged,
}: CardDetailModalProps) {
  const { token, currentUser } = useAuth();
  const moveId = useId();
  const priorityId = useId();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isSavingPriority, setIsSavingPriority] = useState(false);
  const [labelToDelete, setLabelToDelete] = useState<Label | null>(null);
  const [isDeletingLabel, setIsDeletingLabel] = useState(false);
  // Set once the label confirmation closed, so LabelManager can restore focus.
  const [focusRestore, setFocusRestore] = useState<{ labelId: string | null } | null>(null);

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
      // The server re-validates the move rule; a 403 means the caller is
      // not the owner, the card's creator, or a tagged user.
      const fallback =
        err instanceof ApiError && err.isForbidden
          ? "You can't move this card (only its owner or a tagged member can)."
          : "Could not move the card.";
      setActionError(messageOf(err, fallback));
    } finally {
      setIsMoving(false);
    }
  }

  async function saveDueDate(dueDate: string | null) {
    if (!token) throw new Error("You must be signed in to edit cards.");
    const updated = await updateCard(token, card.id, { due_date: dueDate });
    onCardUpdated(updated);
  }

  async function savePriority(value: string) {
    if (!token) return;
    const priority =
      value === "low" || value === "medium" || value === "high" ? value : null;
    setIsSavingPriority(true);
    setActionError(null);
    try {
      const updated = await updateCard(token, card.id, { priority });
      onCardUpdated(updated);
    } catch (err: unknown) {
      setActionError(messageOf(err, "Could not update the priority."));
    } finally {
      setIsSavingPriority(false);
    }
  }

  async function applyLabels(labelIds: string[]) {
    if (!token) throw new Error("You must be signed in to edit cards.");
    try {
      const updated = await setCardLabels(token, card.id, labelIds);
      onCardUpdated(updated);
    } catch (err: unknown) {
      // A label may have been deleted elsewhere: refresh the board's labels.
      if (err instanceof ApiError && err.isNotFound) onLabelsChanged();
      throw err;
    }
  }

  async function saveAssignees(userId: string[]) {
    if (!token) return;
    try {
      const updated = await setCardAssignees(token, card.id, userId);
      onCardUpdated({ ...card, assignee_ids: userId } as Card);
      onCardAssigneesChanged?.();
    } catch (err: unknown) {
      setActionError(messageOf(err, "Could not update card assignees."));
    }
  }

  function closeLabelConfirm(labelId: string | null) {
    setLabelToDelete(null);
    setFocusRestore({ labelId });
  }

  async function handleConfirmLabelDelete() {
    if (!token || !labelToDelete) return;
    const target = labelToDelete;
    setIsDeletingLabel(true);
    setActionError(null);
    try {
      await deleteLabel(token, target.id);
      closeLabelConfirm(null);
      onLabelsChanged();
    } catch (err: unknown) {
      closeLabelConfirm(target.id);
      setActionError(
        err instanceof ApiError && err.isNotFound
          ? "That label no longer exists."
          : messageOf(err, "Could not delete the label."),
      );
      if (err instanceof ApiError && err.isNotFound) onLabelsChanged();
    } finally {
      setIsDeletingLabel(false);
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
        isOpen={isOpen && !confirmingDelete && labelToDelete === null}
        onClose={onClose}
        title={card.title}
        maxWidth="max-w-xl"
      >
        <div className="flex flex-col gap-4">
          <EditCardForm key={card.id} card={card} onSaved={onCardUpdated} />
          <DueDateField
            key={`due:${card.id}:${card.due_date ?? ""}`}
            value={card.due_date}
            onSave={(iso) => saveDueDate(iso)}
            onRemove={() => saveDueDate(null)}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor={priorityId} className="text-sm font-medium text-foreground">
              Priority
            </label>
            <select
              id={priorityId}
              value={card.priority ?? ""}
              disabled={isSavingPriority}
              onChange={(e) => void savePriority(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">No priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <LabelPicker
            key={`labels:${card.id}:${card.labels?.map((l) => l.id).join(",")}`}
            labels={boardLabels}
            selectedIds={card.labels?.map((l) => l.id) ?? []}
            onApply={applyLabels}
          />
          <LabelManager
            boardId={boardId}
            labels={boardLabels}
            onChanged={onLabelsChanged}
            onRequestDelete={setLabelToDelete}
            restoreFocus={focusRestore !== null}
            restoreFocusLabelId={focusRestore?.labelId ?? null}
          />

          {isBoardOwner && boardMembers.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">
                Who can move this card
              </span>
              <div
                role="group"
                aria-label="Card assignees"
                className="flex flex-wrap gap-2"
              >
                {boardMembers
                  .filter((m) => m.role !== "owner" || m.user_id === currentUser?.id)
                  .map((m) => {
                    const checked =
                      card.assignee_ids?.includes(m.user_id) ?? false;
                    return (
                      <label
                        key={m.user_id}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const current = card.assignee_ids ?? [];
                            const next = checked
                              ? current.filter((id) => id !== m.user_id)
                              : [...current, m.user_id];
                            void saveAssignees(next);
                          }}
                          disabled={isSavingPriority}
                          className="h-3.5 w-3.5 accent-[var(--brand)]"
                        />
                        <span className="text-[13px]">{m.name ?? m.email}</span>
                      </label>
                    );
                  })}
              </div>
            </div>
          )}

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
        isOpen={isOpen && labelToDelete !== null}
        onClose={() => {
          if (!isDeletingLabel) closeLabelConfirm(labelToDelete?.id ?? null);
        }}
        title={`Delete label "${labelToDelete?.name ?? ""}"?`}
        description={`It will be removed from ${labelToDelete ? (labelUsage[labelToDelete.id] ?? 0) : 0} ${
          labelToDelete && (labelUsage[labelToDelete.id] ?? 0) === 1 ? "card" : "cards"
        }.`}
        maxWidth="max-w-sm"
      >
        <div className="flex justify-end gap-2">
          <BaseButton
            variant="secondary"
            disabled={isDeletingLabel}
            onClick={() => closeLabelConfirm(labelToDelete?.id ?? null)}
          >
            Cancel
          </BaseButton>
          <BaseButton
            variant="destructive"
            disabled={isDeletingLabel}
            onClick={() => void handleConfirmLabelDelete()}
          >
            Confirm delete
          </BaseButton>
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
