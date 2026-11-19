"use client";

import { useState, useRef, useEffect } from "react";

export interface AddCardFormProps {
  /** Called with the trimmed title when the user submits a valid card. */
  onCardCreate: (title: string) => void;
  /** Called when the user dismisses the form without submitting. */
  onCancel: () => void;
  /** Disables the form while a create request is in flight. */
  isSubmitting?: boolean;
}

const MAX_TITLE_LENGTH = 255;

export function AddCardForm({
  onCardCreate,
  onCancel,
  isSubmitting = false,
}: AddCardFormProps) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function handleTitleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    setTitle(event.target.value);
    if (error) {
      setError(null);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = title.trim();

    if (trimmed.length === 0) {
      setError("Card title is required.");
      textareaRef.current?.focus();
      return;
    }

    if (trimmed.length > MAX_TITLE_LENGTH) {
      setError(`Title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
      textareaRef.current?.focus();
      return;
    }

    onCardCreate(trimmed);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const trimmed = title.trim();

      if (trimmed.length === 0) {
        setError("Card title is required.");
        return;
      }

      if (trimmed.length > MAX_TITLE_LENGTH) {
        setError(`Title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
        return;
      }

      onCardCreate(trimmed);
    }

    if (event.key === "Escape") {
      onCancel();
    }
  }

  const remaining = MAX_TITLE_LENGTH - title.length;
  const isOverLimit = remaining < 0;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor="card-title" className="sr-only">
          Card title
        </label>
        <textarea
          id="card-title"
          ref={textareaRef}
          value={title}
          onChange={handleTitleChange}
          onKeyDown={handleKeyDown}
          placeholder="Card title…"
          rows={2}
          disabled={isSubmitting}
          aria-required
          aria-invalid={error !== null || isOverLimit}
          aria-describedby={
            error ? "card-title-error" : isOverLimit ? "card-title-count" : undefined
          }
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />

        {error && (
          <p id="card-title-error" role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}

        <p
          id="card-title-count"
          aria-live="polite"
          className={`text-right text-xs ${
            isOverLimit ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {remaining} remaining
        </p>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isSubmitting || isOverLimit}
            className="flex-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Adding…" : "Add card"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
