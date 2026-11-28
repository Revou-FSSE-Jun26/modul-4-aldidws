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
import { createLabel } from "@/lib/services/labelsService";
import {
  createComment,
  deleteComment,
  listComments,
  updateComment,
} from "@/lib/services/commentsService";
import { setCardAssignees } from "@/lib/services/membersService";
import type {
  ApiComment,
  BoardMember,
  Card,
  Label,
  LabelColor,
} from "@/lib/types/api";
import { BaseModal } from "@/components/shared/BaseModal";
import { BaseButton } from "@/components/shared/BaseButton";
import { CommentList, type Comment } from "@/components/board/CommentList";
import { DueDateField } from "@/components/board/DueDateField";

const MAX_TITLE_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_COMMENT_LENGTH = 2000;

const COLOR_OPTIONS: ReadonlyArray<{
  value: LabelColor;
  label: string;
  swatchClass: string;
}> = [
  { value: "blue", label: "Blue", swatchClass: "bg-blue-500" },
  { value: "sky", label: "Sky", swatchClass: "bg-sky-400" },
  { value: "graphite", label: "Graphite", swatchClass: "bg-slate-600" },
  { value: "silver", label: "Silver", swatchClass: "bg-gray-300" },
  { value: "red", label: "Red", swatchClass: "bg-red-500" },
  { value: "orange", label: "Orange", swatchClass: "bg-orange-400" },
  { value: "green", label: "Green", swatchClass: "bg-emerald-500" },
  { value: "purple", label: "Purple", swatchClass: "bg-purple-500" },
];

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
   * Board members, shown in the "Assignees" picker. The picker is rendered
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

function emitCommentCountChanged(cardId: string, count: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("revotask:card-comments-changed", {
      detail: { cardId, count },
    }),
  );
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
      <label htmlFor={bodyId} className="text-sm font-medium text-[#173B30]">
        Add a comment
      </label>
      <textarea
        id={bodyId}
        ref={textareaRef}
        value={body}
        onKeyDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          setBody(e.target.value);
          if (error) setError(null);
        }}
        rows={3}
        placeholder="Write a comment..."
        disabled={isSubmitting}
        aria-invalid={error !== null || isOverLimit}
        aria-describedby={error ? errorId : undefined}
        className="w-full resize-none rounded-lg border border-[#D5DDD0] bg-[#F4F6EE] px-3 py-2 text-base text-[#173B30] placeholder:text-[#7B8B81] focus:border-[#16382C] focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-[#B34F48]">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          aria-live="polite"
          className={`text-xs ${isOverLimit ? "text-[#B34F48]" : "text-[#6F7F75]"}`}
        >
          {MAX_COMMENT_LENGTH - body.length} remaining
        </p>
        <BaseButton
          type="submit"
          disabled={isSubmitting || isOverLimit}
          className="w-full justify-center touch-manipulation sm:w-auto"
        >
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
      const normalizedDescription = description.trim();
      const updated = await updateCard(token, card.id, {
        title: trimmedTitle,
        description: normalizedDescription.length > 0 ? normalizedDescription : null,
      });
      onSaved({
        ...card,
        ...updated,
        title: trimmedTitle,
        description: normalizedDescription.length > 0 ? normalizedDescription : null,
      });
      setStatus("Card saved");
    } catch (err: unknown) {
      setError(messageOf(err, "Could not save the card."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2">
      <label htmlFor={`${baseId}-title`} className="text-sm font-medium text-[#173B30]">
        Card title
      </label>
      <input
        id={`${baseId}-title`}
        name="title"
        type="text"
        value={title}
        disabled={isSaving}
        onKeyDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          setTitle(e.target.value);
          if (error) setError(null);
          if (status) setStatus("");
        }}
        className="min-h-10 rounded-lg border border-[#D5DDD0] bg-[#F4F6EE] px-3 py-2 text-base text-[#173B30] focus:border-[#16382C] focus:bg-white focus:outline-none sm:min-h-9 sm:text-sm"
      />
      <label
        htmlFor={`${baseId}-description`}
        className="text-sm font-medium text-[#173B30]"
      >
        Description
      </label>
      <textarea
        id={`${baseId}-description`}
        name="description"
        value={description}
        rows={4}
        placeholder="Add more details about this task..."
        disabled={isSaving}
        onKeyDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          setDescription(e.target.value);
          if (error) setError(null);
          if (status) setStatus("");
        }}
        className="resize-none rounded-lg border border-[#D5DDD0] bg-[#F4F6EE] px-3 py-2 text-base text-[#173B30] placeholder:text-[#7B8B81] focus:border-[#16382C] focus:bg-white focus:outline-none sm:text-sm"
      />
      {error && (
        <p role="alert" className="text-xs text-[#B34F48]">
          {error}
        </p>
      )}
      {status && (
        <p role="status" aria-live="polite" className="text-xs text-[#526D5C]">
          {status}
        </p>
      )}
      <div>
        <BaseButton
          type="submit"
          disabled={isSaving}
          className="w-full justify-center touch-manipulation sm:w-auto"
        >
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
  const [isSavingLabelColor, setIsSavingLabelColor] = useState(false);
  const [isSavingAssignees, setIsSavingAssignees] = useState(false);

  // Load comments each time the modal opens for a card.
  useEffect(() => {
    if (!isOpen || !token) return;
    let cancelled = false;
    listComments(token, card.id)
      .then((items) => {
        if (cancelled) return;
        setCommentsError(null);
        const mapped = items.map(toComment);
        setComments(mapped);
        emitCommentCountChanged(card.id, mapped.length);
      })
      .catch((err: unknown) => {
        if (!cancelled) setCommentsError(messageOf(err, "Failed to load comments."));
      });
    return () => {
      cancelled = true;
      setComments(null);
      setActionError(null);
      setConfirmingDelete(false);
    };
  }, [isOpen, token, card.id]);

  async function handleMove(targetColumnId: string) {
    if (!token || targetColumnId === card.column_id || isMoving) return;
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
      onCardUpdated({ ...card, column_id: targetColumnId, order });
      onCardMoved();
    } catch (err: unknown) {
      setActionError(
        err instanceof ApiError && err.isForbidden
          ? "You can't move this card (only its owner or a tagged member can)."
          : messageOf(err, "Could not move the card."),
      );
    } finally {
      setIsMoving(false);
    }
  }

  async function saveDueDate(dueDate: string | null) {
    if (!token) throw new Error("You must be signed in to edit cards.");
    const updated = await updateCard(token, card.id, { due_date: dueDate });
    onCardUpdated({ ...card, ...updated, due_date: dueDate });
  }

  async function savePriority(value: string) {
    if (!token || isSavingPriority) return;
    const priority =
      value === "low" || value === "medium" || value === "high" ? value : null;
    setIsSavingPriority(true);
    setActionError(null);
    try {
      const updated = await updateCard(token, card.id, { priority });
      onCardUpdated({ ...card, ...updated, priority });
    } catch (err: unknown) {
      setActionError(messageOf(err, "Could not update the priority."));
    } finally {
      setIsSavingPriority(false);
    }
  }

  async function handleToggleColorLabel(color: LabelColor, labelName: string) {
    if (!token || isSavingLabelColor) return;
    setIsSavingLabelColor(true);
    setActionError(null);
    try {
      const currentLabels = card.labels ?? [];
      const existingOnCard = currentLabels.find((l) => l.color === color);

      if (existingOnCard) {
        const nextIds = currentLabels
          .filter((l) => l.color !== color)
          .map((l) => l.id);
        const updated = await setCardLabels(token, card.id, nextIds);
        const nextLabels =
          updated.labels ?? currentLabels.filter((l) => l.color !== color);
        onCardUpdated({ ...card, ...updated, labels: nextLabels });
      } else {
        let boardLabel = boardLabels.find((l) => l.color === color);
        let createdNew = false;
        if (!boardLabel) {
          boardLabel = await createLabel(token, boardId, {
            name: labelName,
            color,
          });
          createdNew = true;
        }
        const nextIds = Array.from(
          new Set([...currentLabels.map((l) => l.id), boardLabel.id]),
        );
        const updated = await setCardLabels(token, card.id, nextIds);
        const nextLabels = updated.labels ?? [...currentLabels, boardLabel];
        onCardUpdated({ ...card, ...updated, labels: nextLabels });
        if (createdNew) onLabelsChanged();
      }
    } catch (err: unknown) {
      setActionError(messageOf(err, "Could not update label color."));
    } finally {
      setIsSavingLabelColor(false);
    }
  }

  async function saveAssignees(userIds: string[]) {
    if (!token || isSavingAssignees) return;
    setIsSavingAssignees(true);
    setActionError(null);
    try {
      await setCardAssignees(token, card.id, userIds);
      onCardUpdated({ ...card, assignee_ids: userIds });
      onCardAssigneesChanged?.();
    } catch (err: unknown) {
      setActionError(messageOf(err, "Could not update card assignees."));
    } finally {
      setIsSavingAssignees(false);
    }
  }

  async function handleDelete() {
    if (!token || isDeleting) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await deleteCard(token, card.id);
      setConfirmingDelete(false);
      onCardDeleted(card.id);
    } catch (err: unknown) {
      setConfirmingDelete(false);
      if (err instanceof ApiError && err.isNotFound) {
        onCardDeleted(card.id);
        return;
      }
      setActionError(messageOf(err, "Could not delete the card."));
    } finally {
      setIsDeleting(false);
    }
  }

  function handleCreatedComment(comment: Comment) {
    setComments((prev) => {
      const next = [...(prev ?? []), comment];
      emitCommentCountChanged(card.id, next.length);
      return next;
    });
  }

  async function handleEditComment(commentId: string, body: string) {
    if (!token) throw new Error("You must be signed in.");
    const updated = toComment(await updateComment(token, commentId, body));
    setComments((prev) => (prev ?? []).map((c) => (c.id === commentId ? updated : c)));
  }

  async function handleDeleteComment(commentId: string) {
    if (!token) throw new Error("You must be signed in.");
    await deleteComment(token, commentId);
    setComments((prev) => {
      const next = (prev ?? []).filter((c) => c.id !== commentId);
      emitCommentCountChanged(card.id, next.length);
      return next;
    });
  }

  const selectedColors = new Set((card.labels ?? []).map((l) => l.color));

  return (
    <>
      <BaseModal
        isOpen={isOpen && !confirmingDelete}
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
            <label htmlFor={priorityId} className="text-sm font-medium text-[#173B30]">
              Priority
            </label>
            <select
              id={priorityId}
              value={card.priority ?? ""}
              disabled={isSavingPriority}
              onChange={(e) => void savePriority(e.target.value)}
              className="min-h-10 rounded-lg border border-[#D5DDD0] bg-[#F4F6EE] px-3 py-2 text-base text-[#173B30] focus:border-[#16382C] focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9 sm:text-sm"
            >
              <option value="">No priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#173B30]">Label color</span>
            <div
              role="group"
              aria-label="Label color"
              className="flex flex-wrap items-center gap-1.5 sm:gap-2"
            >
              {COLOR_OPTIONS.map((opt) => {
                const isSelected = selectedColors.has(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-label={opt.label}
                    aria-pressed={isSelected}
                    title={opt.label}
                    disabled={isSavingLabelColor}
                    onClick={() => void handleToggleColorLabel(opt.value, opt.label)}
                    className="inline-flex h-8 w-11 touch-manipulation cursor-pointer items-center justify-center rounded-lg p-1 transition-colors hover:bg-[#EBF0E2] disabled:cursor-not-allowed disabled:opacity-50 sm:h-6 sm:w-10 sm:p-0.5"
                  >
                    <span
                      className={`block h-2.5 w-full rounded-full transition-all ${opt.swatchClass} ${
                        isSelected
                          ? "scale-105 ring-2 ring-[#16382C] ring-offset-2 ring-offset-[#FAF9F6]"
                          : "opacity-80 hover:opacity-100"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {isBoardOwner && boardMembers.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[#173B30]">
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
                        className="flex min-h-9 max-w-full cursor-pointer touch-manipulation items-center gap-2 rounded-lg border border-[#D5DDD0] bg-[#F4F6EE] px-3 py-1.5 text-xs text-[#173B30] hover:bg-[#EBF0E2] sm:min-h-0 sm:px-2.5 sm:py-1"
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
                          disabled={isSavingAssignees}
                          className="h-4 w-4 shrink-0 accent-[#16382C] sm:h-3.5 sm:w-3.5"
                        />
                        <span className="truncate text-[13px]">{m.name ?? m.email}</span>
                      </label>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor={moveId} className="text-sm font-medium text-[#173B30]">
              Move to column
            </label>
            <select
              id={moveId}
              value={card.column_id}
              disabled={isMoving}
              onChange={(e) => void handleMove(e.target.value)}
              className="min-h-10 rounded-lg border border-[#D5DDD0] bg-[#F4F6EE] px-3 py-2 text-base text-[#173B30] focus:border-[#16382C] focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9 sm:text-sm"
            >
              {columns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>

          {actionError && (
            <p role="alert" className="text-xs text-[#B34F48]">
              {actionError}
            </p>
          )}

          <div>
            <BaseButton
              variant="destructive"
              onClick={() => setConfirmingDelete(true)}
              className="w-full justify-center touch-manipulation sm:w-auto"
            >
              Delete card
            </BaseButton>
          </div>

          <hr className="border-[#DCE4D7]" />

          {commentsError ? (
            <p role="alert" className="text-xs text-[#B34F48]">
              {commentsError}
            </p>
          ) : comments === null ? (
            <p className="text-xs text-[#6F7F75]" aria-live="polite">
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
                  onCreated={handleCreatedComment}
                />
              }
            />
          )}
        </div>
      </BaseModal>

      <BaseModal
        isOpen={isOpen && confirmingDelete}
        onClose={() => {
          if (!isDeleting) setConfirmingDelete(false);
        }}
        title="Delete this card?"
        description="The card and access to its comments will be removed from the board."
        maxWidth="max-w-sm"
      >
        <div className="flex flex-wrap justify-end gap-2">
          <BaseButton
            variant="secondary"
            disabled={isDeleting}
            onClick={() => setConfirmingDelete(false)}
            className="touch-manipulation"
          >
            Cancel
          </BaseButton>
          <BaseButton
            variant="destructive"
            disabled={isDeleting}
            onClick={() => void handleDelete()}
            className="touch-manipulation"
          >
            Confirm delete
          </BaseButton>
        </div>
      </BaseModal>
    </>
  );
}