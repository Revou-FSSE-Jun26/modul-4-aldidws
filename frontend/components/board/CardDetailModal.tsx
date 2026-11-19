"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { get, post } from "@/lib/apiClient";
import { ApiError } from "@/lib/errors";
import { BaseModal } from "@/components/shared/BaseModal";
import { BaseButton } from "@/components/shared/BaseButton";
import { CommentList, type Comment } from "@/components/board/CommentList";

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface CardDetail {
  id: string;
  title: string;
  description?: string | null;
  assignee?: string | null;
  dueDate?: string | null;
}

export interface CardDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: CardDetail;
  /**
   * Optional initial comments passed by the parent.  When the modal opens it
   * will immediately refetch comments from the API; this prop seeds the list
   * while the fetch is in flight so there is no flash of empty content.
   */
  comments?: Comment[];
  onCommentCreated?: (comment: Comment) => void;
}

// ---------------------------------------------------------------------------
// API helpers — use apiClient so base URL, auth header, and error typing are
// handled centrally. No raw fetch calls in this file.
// ---------------------------------------------------------------------------

interface CommentApiItem {
  id: string;
  card_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

/** Fetch the comment list for a card. */
async function fetchComments(
  token: string,
  cardId: string,
): Promise<Comment[]> {
  const items = await get<CommentApiItem[]>(`/api/cards/${cardId}/comments`, {
    token,
  });
  return items.map((c) => ({
    id: c.id,
    // author_id is a UUID; a richer display name mapping can be added when the
    // API returns author display names.
    authorName: c.author_id,
    body: c.body,
    createdAt: c.created_at,
  }));
}

/** POST a new comment and return the created item. */
async function createComment(
  token: string,
  cardId: string,
  body: string,
): Promise<CommentApiItem> {
  return post<CommentApiItem>(`/api/cards/${cardId}/comments`, { body }, { token });
}

// ---------------------------------------------------------------------------
// Comment form
// ---------------------------------------------------------------------------

const MAX_COMMENT_LENGTH = 2000;

interface CommentFormProps {
  cardId: string;
  onCommentCreated: (comment: Comment) => void;
}

function CommentForm({ cardId, onCommentCreated }: CommentFormProps) {
  const { token, currentUser } = useAuth();
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmedBody = body.trim();
  const isBodyEmpty = trimmedBody.length === 0;
  const isOverLimit = trimmedBody.length > MAX_COMMENT_LENGTH;
  const remaining = MAX_COMMENT_LENGTH - body.length;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (isBodyEmpty) {
      setError("Comment cannot be empty.");
      textareaRef.current?.focus();
      return;
    }

    if (isOverLimit) {
      setError(`Comment must be ${MAX_COMMENT_LENGTH} characters or fewer.`);
      textareaRef.current?.focus();
      return;
    }

    if (!token) {
      setError("You must be signed in to comment.");
      return;
    }

    setIsSubmitting(true);

    try {
      // POST /api/cards/<cardId>/comments via apiClient
      const created = await createComment(token, cardId, trimmedBody);

      const newComment: Comment = {
        id: created.id,
        authorName: currentUser?.email ?? "You",
        body: created.body,
        createdAt: created.created_at,
      };

      onCommentCreated(newComment);
      setBody("");
      textareaRef.current?.focus();
    } catch (err: unknown) {
      // Surface the ApiError message if available; otherwise a generic string.
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to post comment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2">
      <label htmlFor="comment-body" className="sr-only">
        Add a comment
      </label>
      <textarea
        id="comment-body"
        ref={textareaRef}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          if (error) setError(null);
        }}
        placeholder="Add a comment…"
        rows={3}
        disabled={isSubmitting}
        aria-required
        aria-invalid={error !== null || isOverLimit}
        aria-describedby={
          error
            ? "comment-body-error"
            : isOverLimit
              ? "comment-body-count"
              : undefined
        }
        className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />

      {error && (
        <p id="comment-body-error" role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <p
          id="comment-body-count"
          aria-live="polite"
          className={`text-xs ${isOverLimit ? "text-destructive" : "text-muted-foreground"}`}
        >
          {remaining} remaining
        </p>

        <BaseButton
          type="submit"
          variant="primary"
          disabled={isSubmitting || isBodyEmpty || isOverLimit}
        >
          {isSubmitting ? "Posting…" : "Post comment"}
        </BaseButton>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Modal that displays card details and an inline comment thread.
 *
 * On open: calls GET /api/cards/<id>/comments via apiClient and populates the
 * comment list from the server.  The optional `comments` prop seeds the list
 * while the fetch is in flight.
 *
 * On submit: calls POST /api/cards/<id>/comments via apiClient and appends
 * the new comment optimistically without a full refetch.
 *
 * Uses `"use client"` because it manages comment state and reads AuthContext.
 */
export function CardDetailModal({
  isOpen,
  onClose,
  card,
  comments: initialComments = [],
  onCommentCreated,
}: CardDetailModalProps) {
  const { token } = useAuth();

  const [localComments, setLocalComments] = useState<Comment[]>(initialComments);
  const [isFetchingComments, setIsFetchingComments] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch comments from the server each time the modal opens.
  useEffect(() => {
    if (!isOpen || !token) return;

    let cancelled = false;
    setIsFetchingComments(true);
    setFetchError(null);

    // GET /api/cards/<card.id>/comments
    fetchComments(token, card.id)
      .then((data) => {
        if (!cancelled) setLocalComments(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFetchError(
            err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Failed to load comments.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsFetchingComments(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, token, card.id]);

  // Reset to initial prop when the modal closes so stale data doesn't flash
  // on next open before the fetch completes.
  useEffect(() => {
    if (!isOpen) {
      setLocalComments(initialComments);
      setFetchError(null);
    }
  }, [isOpen, initialComments]);

  function handleCommentCreated(comment: Comment) {
    setLocalComments((prev) => [...prev, comment]);
    onCommentCreated?.(comment);
  }

  const formattedDueDate = card.dueDate
    ? new Date(card.dueDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={card.title} maxWidth="max-w-xl">
      <div className="flex flex-col gap-4">
        {/* Meta row: assignee + due date */}
        {(card.assignee ?? card.dueDate) && (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {card.assignee && (
              <div className="flex items-center gap-1.5">
                <dt className="font-medium text-muted-foreground">Assignee</dt>
                <dd className="text-foreground">{card.assignee}</dd>
              </div>
            )}
            {formattedDueDate && (
              <div className="flex items-center gap-1.5">
                <dt className="font-medium text-muted-foreground">Due</dt>
                <dd className="text-foreground">{formattedDueDate}</dd>
              </div>
            )}
          </dl>
        )}

        {/* Description */}
        {card.description ? (
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {card.description}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No description.</p>
        )}

        <hr className="border-border" />

        {/* Comments — loading / error / list */}
        {isFetchingComments ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Loading comments…
          </p>
        ) : fetchError ? (
          <p role="alert" className="text-xs text-destructive">
            {fetchError}
          </p>
        ) : (
          <CommentList
            comments={localComments}
            footer={
              <CommentForm
                cardId={card.id}
                onCommentCreated={handleCommentCreated}
              />
            }
          />
        )}
      </div>
    </BaseModal>
  );
}
