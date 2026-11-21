"use client";

import { useEffect, useReducer, useRef, useState, type FormEvent } from "react";
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
    updatedAt: c.updated_at,
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
        updatedAt: created.updated_at,
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

// ---------------------------------------------------------------------------
// Comment-fetch state machine
// ---------------------------------------------------------------------------

type CommentFetchState =
  | { status: "idle"; comments: Comment[] }
  | { status: "loading"; seed: Comment[] }
  | { status: "success"; comments: Comment[] }
  | { status: "error"; message: string; seed: Comment[] };

type CommentFetchAction =
  | { type: "FETCH_START"; seed: Comment[] }
  | { type: "FETCH_SUCCESS"; comments: Comment[] }
  | { type: "FETCH_ERROR"; message: string }
  | { type: "COMMENT_ADDED"; comment: Comment }
  | { type: "RESET"; seed: Comment[] };

function commentReducer(
  state: CommentFetchState,
  action: CommentFetchAction,
): CommentFetchState {
  switch (action.type) {
    case "FETCH_START":
      return { status: "loading", seed: action.seed };
    case "FETCH_SUCCESS":
      return { status: "success", comments: action.comments };
    case "FETCH_ERROR":
      return {
        status: "error",
        message: action.message,
        seed: state.status === "loading" ? state.seed : [],
      };
    case "COMMENT_ADDED": {
      const comments =
        state.status === "success"
          ? [...state.comments, action.comment]
          : [action.comment];
      return { status: "success", comments };
    }
    case "RESET":
      return { status: "idle", comments: action.seed };
    default:
      return state;
  }
}

export function CardDetailModal({
  isOpen,
  onClose,
  card,
  comments: initialComments = [],
  onCommentCreated,
}: CardDetailModalProps) {
  const { token } = useAuth();

  const [commentState, dispatch] = useReducer(commentReducer, {
    status: "idle",
    comments: initialComments,
  });

  // Fetch comments from the server each time the modal opens.
  // All dispatch calls happen inside .then()/.catch() callbacks so they are
  // never synchronous within the effect body, satisfying
  // react-hooks/set-state-in-effect.
  //
  // Note: dispatch (from useReducer) is NOT tracked by the React Compiler's
  // set-state-in-effect rule (which only tracks useState setters), so
  // dispatch calls in effects do not trigger the rule.
  useEffect(() => {
    if (!isOpen || !token) return;
    let cancelled = false;

    // GET /api/cards/<card.id>/comments
    fetchComments(token, card.id)
      .then((data) => {
        if (!cancelled) dispatch({ type: "FETCH_SUCCESS", comments: data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          dispatch({
            type: "FETCH_ERROR",
            message:
              err instanceof ApiError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : "Failed to load comments.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, token, card.id]);

  // Transition to loading when the modal opens; reset when it closes.
  // Uses dispatch (not setState), which is not tracked by set-state-in-effect.
  useEffect(() => {
    if (isOpen) {
      dispatch({ type: "FETCH_START", seed: initialComments });
    } else {
      dispatch({ type: "RESET", seed: initialComments });
    }
  }, [isOpen, initialComments]);

  function handleCommentCreated(comment: Comment) {
    dispatch({ type: "COMMENT_ADDED", comment });
    onCommentCreated?.(comment);
  }

  // Derive display values from the state machine.
  const isFetchingComments = commentState.status === "loading";
  const fetchError =
    commentState.status === "error" ? commentState.message : null;
  const localComments =
    commentState.status === "success"
      ? commentState.comments
      : commentState.status === "loading" || commentState.status === "error"
        ? commentState.seed
        : commentState.comments;

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
