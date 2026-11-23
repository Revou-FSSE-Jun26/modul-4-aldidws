import { type ReactNode } from "react";

export interface Comment {
  id: string;
  authorName: string;
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
}

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

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <li
      className="flex flex-col gap-0.5"
      data-testid="comment-item"
      data-updated-at={comment.updatedAt ?? comment.createdAt}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">
          {comment.authorName}
        </span>
        <time
          dateTime={comment.createdAt}
          className="shrink-0 text-xs text-muted-foreground"
          title={new Date(comment.createdAt).toLocaleString()}
        >
          {formatRelativeTime(comment.createdAt)}
        </time>
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
    </li>
  );
}

/**
 * Renders an ordered list of comments for a card.
 * Presentational only — data fetching and mutations belong in the parent.
 * Pass a compose form as `footer` to keep this component focused on display.
 */
export function CommentList({ comments, footer }: CommentListProps) {
  return (
    <section aria-label="Comments">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </ol>
      )}

      {footer && <div className="mt-4">{footer}</div>}
    </section>
  );
}
