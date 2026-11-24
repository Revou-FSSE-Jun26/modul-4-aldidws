"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BaseButton } from "@/components/shared/BaseButton";

export interface AddCardFormProps {
  /** Called with the trimmed title when the user submits a valid card. */
  onCardCreate: (title: string) => void;
  /** Called when the user dismisses the form without submitting. */
  onCancel: () => void;
  /** Disables the form while a create request is in flight. */
  isSubmitting?: boolean;
  /** Server or request error to show under the field. The typed title is kept. */
  errorMessage?: string | null;
}

const MAX_TITLE_LENGTH = 255;

export function AddCardForm({
  onCardCreate,
  onCancel,
  isSubmitting = false,
  errorMessage = null,
}: AddCardFormProps) {
  const baseId = useId();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const titleId = `${baseId}-title`;
  const errorId = `${baseId}-error`;
  const countId = `${baseId}-count`;
  const shownError = error ?? errorMessage;

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function handleTitleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    setTitle(event.target.value);
    if (error) {
      setError(null);
    }
  }

  function submit() {
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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
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
        <label htmlFor={titleId} className="sr-only">
          Card title
        </label>
        <textarea
          id={titleId}
          ref={textareaRef}
          value={title}
          onChange={handleTitleChange}
          onKeyDown={handleKeyDown}
          placeholder="Card title…"
          rows={2}
          disabled={isSubmitting}
          aria-required
          aria-invalid={shownError !== null || isOverLimit}
          aria-describedby={
            shownError ? errorId : isOverLimit ? countId : undefined
          }
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />

        {shownError && (
          <p id={errorId} role="alert" className="text-xs text-destructive">
            {shownError}
          </p>
        )}

        <p
          id={countId}
          aria-live="polite"
          className={`text-right text-xs ${
            isOverLimit ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {remaining} remaining
        </p>

        <div className="flex items-center gap-2">
          <BaseButton
            type="submit"
            disabled={isSubmitting || isOverLimit}
            className="flex-1"
          >
            {isSubmitting ? "Saving…" : "Save card"}
          </BaseButton>
          <BaseButton
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </BaseButton>
        </div>
      </div>
    </form>
  );
}
