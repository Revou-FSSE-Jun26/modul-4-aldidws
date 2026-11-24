"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { createBoard } from "@/lib/services/boardsService";
import { ApiError } from "@/lib/errors";
import type { Board } from "@/lib/types/api";
import { BaseButton } from "@/components/shared/BaseButton";

const MAX_NAME_LENGTH = 100;

export interface CreateBoardFormProps {
  /** Called with the board returned by POST /api/boards. */
  onCreated: (board: Board) => void;
}

/** "Create board" button that reveals a small name form. */
export function CreateBoardForm({ onCreated }: CreateBoardFormProps) {
  const { token } = useAuth();
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Board name is required.");
      inputRef.current?.focus();
      return;
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      setError(`Board name must be ${MAX_NAME_LENGTH} characters or fewer.`);
      return;
    }
    if (!token) {
      setError("You must be signed in to create a board.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const board = await createBoard(token, trimmed);
      onCreated(board);
      setName("");
      setIsOpen(false);
      setStatus("Board created");
    } catch (err: unknown) {
      const fieldError =
        err instanceof ApiError ? err.details?.name?.[0] : undefined;
      setError(
        fieldError ??
          (err instanceof Error ? err.message : "Could not create the board."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mb-6">
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
      {isOpen ? (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex max-w-md flex-col gap-2"
        >
          <label htmlFor={inputId} className="text-sm font-medium text-foreground">
            Board name
          </label>
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={name}
            autoFocus
            maxLength={MAX_NAME_LENGTH}
            disabled={isSubmitting}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error !== null}
            aria-describedby={error ? errorId : undefined}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          {error && (
            <p id={errorId} role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <BaseButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create"}
            </BaseButton>
            <BaseButton
              variant="secondary"
              disabled={isSubmitting}
              onClick={() => {
                setIsOpen(false);
                setName("");
                setError(null);
              }}
            >
              Cancel
            </BaseButton>
          </div>
        </form>
      ) : (
        <BaseButton onClick={() => setIsOpen(true)}>Create board</BaseButton>
      )}
    </div>
  );
}
