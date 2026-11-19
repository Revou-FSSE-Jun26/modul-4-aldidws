"use client";

import { useState, useRef, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
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
  assignee?: string | null;    // display name of the assignee, if available
  dueDate?: string | null;     // ISO 8601 date string, e.g. "2024-03-15"
}

export interface CardDetailModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Called when the user closes the modal. */
  onClose: () => void;
  /** The card to display. */
  card: CardDetail;
  /**
   * Comments to display, pre-fetched by the parent.
   * The parent is responsible for refreshing this list after a new comment
   * is successfully created (call onCommentCreated or refetch externally).
   */
  comments: Comment[];
  /**
   * Called with the newly created comment after a successful POST.
   * The parent can use this to append the comment to its local state without
   * a full refetch.
   */
  onCommentCreated?: (comment: Comment) => void;
}

// ---------------------------------------------------------------------------
// API helper — isolated fetch so the component stays presentation-focused
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

interface CreatedComment {
  id: string;
  card_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

async function postComment(
  token: string,
  cardId: string,
  body: string,
): Promise<CreatedComment> {
  const res = await fetch(`${API_BASE}/api/cards/${cardId}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ body }),
    cache: "no-store",
  });

  if (!res.ok) {
    // Preserve the user's input on failure (frontend.md §8.1)
    const json = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      json?.error?.message ?? `Failed to post comment (${res.status})`,
    );
  }

  const json = (await res.json()) as { data: CreatedComment };
  return json.data;
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
      const created = await postComment(token, cardId, trimmedBody);

      // Map the API response to the Comment shape CommentList expects.
      const newComment: Comment = {
        id: created.id,
        // The API returns author_id (UUID). We use currentUser.email as the
        // display name fallback; a richer mapping can be added when the API
        // returns author display names.
        authorName: currentUser?.email ?? "You",
        body: created.body,
        createdAt: created.created_at,
      };

      onCommentCreated(newComment);
      setBody("");
      // Preserve focus in the textarea so the user can type another comment.
      textareaRef.current?.focus();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to post comment.",
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
        <p
          id="comment-body-error"
          role="alert"
          className="text-xs text-destructive"
        >
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
 * Composition:
 *   BaseModal (dialog shell + accessibility)
 *   └── Card metadata section (title, description, assignee, due date)
 *   └── CommentList (existing component, receives comments as prop)
 *         └── footer slot: CommentForm (controlled textarea + BaseButton)
 *
 * Uses `"use client"` because it manages comment input state and reads
 * AuthContext for the token.
 */
export function CardDetailModal({
  isOpen,
  onClose,
  card,
  comments,
  onCommentCreated,
}: CardDetailModalProps) {
  // Local optimistic comment list — starts from the parent's prop and grows
  // as new comments are submitted.  On close the parent is authoritative.
  const [localComments, setLocalComments] = useState<Comment[]>(comments);

  // Sync when the parent refreshes the list (e.g. after re-fetch)
  // We use a simple reference comparison; a more robust solution would use
  // a key prop on the modal to fully reset state.
  if (comments !== localComments && !isOpen) {
    setLocalComments(comments);
  }

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
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={card.title}
      maxWidth="max-w-xl"
    >
      {/* ---- Card metadata ---- */}
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
          <p className="text-sm text-muted-foreground italic">
            No description.
          </p>
        )}

        {/* Divider */}
        <hr className="border-border" />

        {/* ---- Comments ---- */}
        <CommentList
          comments={localComments}
          footer={
            <CommentForm
              cardId={card.id}
              onCommentCreated={handleCommentCreated}
            />
          }
        />
      </div>
    </BaseModal>
  );
}
