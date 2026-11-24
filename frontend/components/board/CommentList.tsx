"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";

export interface Comment {
  id: string;
  authorName: string;
  /** Author's user id; used to decide whether edit/delete controls show. */
  authorId?: string;
  body: string;
  /** ISO 8601 timestamp string */
  createdAt: string;
  /** ISO 8601 timestamp string — set by the server on creation and each edit */
  updatedAt?: string;
}

export interface CommentListProps {
  comments: Comment[];
  /** Rendered below the comment list (e.g. a compose form). */
  footer?: ReactNode;
  /** Comments whose `authorId` equals this id get edit and delete controls. */
  currentUserId?: string;
  /** Save an edited body. Reject to keep the editor open and show the error. */
  onEdit?: (commentId: string, body: string) => Promise<void>;
  /** Delete a comment. Reject to show the error. */
  onDelete?: (commentId: string) => Promise<void>;
}

const MAX_COMMENT_LENGTH = 2000;

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface CommentItemProps {
  comment: Comment;
  canModify: boolean;
  onEdit?: CommentListProps["onEdit"];
  onDelete?: CommentListProps["onDelete"];
}

function CommentItem({ comment, canModify, onEdit, onDelete }: CommentItemProps) {
  const fieldId = useId();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdited =
    comment.updatedAt !== undefined && comment.updatedAt !== comment.createdAt;

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Comment cannot be empty.");
      return;
    }
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      setError(`Comment must be ${MAX_COMMENT_LENGTH} characters or fewer.`);
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await onEdit?.(comment.id, trimmed);
      setIsEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save the comment.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete() {
    setIsBusy(true);
    setError(null);
    try {
      await onDelete?.(comment.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete the comment.");
      setIsBusy(false);
    }
  }

  return (
    <li
      className="flex flex-col gap-0.5"
      data-testid="comment-item"
      data-updated-at={comment.updatedAt ?? comment.createdAt}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
          {comment.authorName}
          {isEdited && <BaseBadge>edited</BaseBadge>}
        </span>
        <time
          dateTime={comment.createdAt}
          className="shrink-0 text-xs text-muted-foreground"
          title={new Date(comment.createdAt).toLocaleString()}
        >
          {formatRelativeTime(comment.createdAt)}
        </time>
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} noValidate className="flex flex-col gap-2">
          <label htmlFor={fieldId} className="sr-only">
            Edit comment text
          </label>
          <textarea
            id={fieldId}
            value={draft}
            rows={3}
            disabled={isBusy}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-2">
            <BaseButton type="submit" size="sm" disabled={isBusy}>
              Save comment
            </BaseButton>
            <BaseButton
              size="sm"
              variant="secondary"
              disabled={isBusy}
              onClick={() => {
                setIsEditing(false);
                setDraft(comment.body);
                setError(null);
              }}
            >
              Cancel
            </BaseButton>
          </div>
        </form>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
          {canModify && (
            <div className="mt-1 flex gap-2">
              <BaseButton
                size="sm"
                variant="secondary"
                disabled={isBusy}
                onClick={() => {
                  setDraft(comment.body);
                  setIsEditing(true);
                }}
              >
                Edit comment
              </BaseButton>
              <BaseButton
                size="sm"
                variant="destructive"
                disabled={isBusy}
                onClick={handleDelete}
              >
                Delete comment
              </BaseButton>
            </div>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}

/**
 * Renders an ordered list of comments for a card.
 * Data fetching and mutations belong in the parent; edit and delete are
 * delegated through `onEdit` / `onDelete` and only offered for the current
 * user's own comments.
 */
export function CommentList({
  comments,
  footer,
  currentUserId,
  onEdit,
  onDelete,
}: CommentListProps) {
  return (
    <section aria-label="Comments">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              canModify={
                currentUserId !== undefined &&
                comment.authorId === currentUserId &&
                (onEdit !== undefined || onDelete !== undefined)
              }
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ol>
      )}

      {footer && <div className="mt-4">{footer}</div>}
    </section>
  );
}
